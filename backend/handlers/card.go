package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

type GenerateCardRequest struct {
	BirthdayID      string `json:"birthday_id" binding:"required"`
	VoiceTranscript string `json:"voice_transcript" binding:"required"`
}

func GenerateCard(c *gin.Context) {
	var req GenerateCardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ANTHROPIC_API_KEY not set"})
		return
	}

	// Fetch person + event details by event ID
	var name, relationship, notes, language, category, eventTitle string
	var eventDate time.Time
	err := DB.QueryRow(context.Background(),
		`SELECT p.name, e.event_date, p.relationship, p.notes,
		        COALESCE(p.language, '') AS language,
		        COALESCE(e.type, 'birthday') AS category,
		        COALESCE(e.title, '') AS event_title
		 FROM events e
		 JOIN people p ON p.id = e.person_id
		 WHERE e.id = $1`,
		req.BirthdayID,
	).Scan(&name, &eventDate, &relationship, &notes, &language, &category, &eventTitle)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "event not found"})
		return
	}

	// Build prompt
	relationshipLine := ""
	if relationship != "" {
		relationshipLine = fmt.Sprintf("Relationship to sender: %s\n", relationship)
	}
	notesLine := ""
	if notes != "" {
		notesLine = fmt.Sprintf("Notes about them: %s\n", notes)
	}

	// Category-aware event description and tone guide
	var eventDesc, toneGuide string
	switch category {
	case "milestone":
		desc := eventTitle
		if desc == "" {
			desc = "an important milestone"
		}
		eventDesc = fmt.Sprintf("Write an encouraging, supportive message for %s on the occasion of: %s (on %s).",
			name, desc, eventDate.Format("January 2"))
		toneGuide = `This is a milestone message. Tone guide:
- Lead with genuine belief in them ("I believe in you", "you've got this")
- Acknowledge the significance of the moment without over-hyping it
- Warm and personal, like a close friend cheering them on
- No generic motivational clichés`

	case "anniversary":
		eventDesc = fmt.Sprintf("Write a message for %s to mark their anniversary on %s.",
			name, eventDate.Format("January 2"))
		toneGuide = `This is an anniversary message. Tone guide:
- Deep warmth and appreciation for the time shared
- Romantic if the relationship is a partner/spouse, otherwise deeply warm and affectionate
- Acknowledge the time that has passed and what it means
- Heartfelt, not cheesy`

	case "hard_date":
		desc := eventTitle
		if desc == "" {
			desc = "a difficult day"
		}
		eventDesc = fmt.Sprintf("Write a gentle message for %s on %s — this is a hard date: %s.",
			name, eventDate.Format("January 2"), desc)
		toneGuide = `This is a hard_date message. Tone guide:
- Gentle, soft, and present — "I'm thinking of you today", "I'm here"
- Acknowledge the weight of the day without trying to fix it
- No toxic positivity, no silver linings, no "stay strong"
- Short is better — sometimes less is more`

	default: // birthday
		eventDesc = fmt.Sprintf("Write a warm, personal birthday message for %s, who is turning %d on %s.",
			name, calculateAge(eventDate), eventDate.Format("January 2"))
		toneGuide = `This is a birthday message. Tone guide:
- Celebratory and warm, specific to this person
- Personal and heartfelt, not generic
- Joyful without being over-the-top`
	}

	languageLine := ""
	if language == "zh-TW" || language == "zh" {
		languageLine = "\nWrite the message in Traditional Chinese (繁體中文). Make it feel natural and warm, not like a translation.\n"
	} else if language != "" && language != "en" {
		languageLine = fmt.Sprintf("\nWrite the message in this language: %s. Make it feel natural and warm, not like a translation.\n", language)
	}

	prompt := fmt.Sprintf(
		`%s
%s%s%s
%s
The sender recorded this voice note about what they want to say: "%s"

Write the message as if from the sender directly to %s. Make it specific to the details above.
Keep it to 3–5 sentences. Do not add a subject line or sign-off — just the message body.`,
		eventDesc,
		relationshipLine,
		notesLine,
		languageLine,
		toneGuide,
		req.VoiceTranscript,
		name,
	)

	reqBody, _ := json.Marshal(claudeRequest{
		Model:     "claude-sonnet-4-6",
		MaxTokens: 512,
		Messages:  []claudeMessage{{Role: "user", Content: prompt}},
	})

	httpReq, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build request: " + err.Error()})
		return
	}
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	httpReq.Header.Set("content-type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Claude API request failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)

	var claudeResp claudeResponse
	if err := json.Unmarshal(respBytes, &claudeResp); err != nil || len(claudeResp.Content) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse Claude response"})
		return
	}

	message := claudeResp.Content[0].Text

	// Save card with status 'pending'
	var cardID string
	err = DB.QueryRow(context.Background(),
		`INSERT INTO cards (birthday_id, message, status) VALUES ($1, $2, 'pending') RETURNING id`,
		req.BirthdayID, message,
	).Scan(&cardID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save card: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"id":      cardID,
		"message": message,
	})
}

type UpdateCardRequest struct {
	EditedMessage string `json:"edited_message" binding:"required"`
}

func UpdateCard(c *gin.Context) {
	cardID := c.Param("id")

	var req UpdateCardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tag, err := DB.Exec(context.Background(),
		`UPDATE cards SET edited_message=$1, was_edited=true WHERE id=$2`,
		req.EditedMessage, cardID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "card not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func DeleteCard(c *gin.Context) {
	cardID := c.Param("id")

	tag, err := DB.Exec(context.Background(),
		`DELETE FROM cards WHERE id=$1`, cardID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "card not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

type SendCardRequest struct {
	Channel string `json:"channel" binding:"required"`
}

func SendCard(c *gin.Context) {
	cardID := c.Param("id")

	var req SendCardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tag, err := DB.Exec(context.Background(),
		`UPDATE cards SET status='sent', channel=$1 WHERE id=$2`,
		req.Channel, cardID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "card not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// calculateAge returns the age the person will turn on their next birthday.
// If their birthday this year has already passed, it returns next year's age.
func calculateAge(birthday time.Time) int {
	now := time.Now()
	age := now.Year() - birthday.Year()
	// Adjust if they haven't had their birthday yet this year
	if now.Month() < birthday.Month() || (now.Month() == birthday.Month() && now.Day() < birthday.Day()) {
		age--
	}
	return age + 1 // +1 because we want the age they're turning, not their current age
}
