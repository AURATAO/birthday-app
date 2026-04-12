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
	var name, relationship, notes, language string
	var birthdayDate time.Time
	err := DB.QueryRow(context.Background(),
		`SELECT p.name, e.event_date, p.relationship, p.notes, COALESCE(p.language, '') as language
		 FROM events e
		 JOIN people p ON p.id = e.person_id
		 WHERE e.id = $1`,
		req.BirthdayID,
	).Scan(&name, &birthdayDate, &relationship, &notes, &language)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "birthday not found"})
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

	languageLine := ""
	if language != "" {
		languageLine = fmt.Sprintf("\nWrite the birthday message in this language: %s\nMake it feel natural and warm in that language, not like a translation.\n", language)
	}

	prompt := fmt.Sprintf(
		`Write a warm, personal birthday message for %s, who is turning %d on %s.
%s%s%sThe sender recorded this voice note about what they want to say: "%s"

Write the message as if from the sender directly to %s. Make it heartfelt and specific to the details above.
Keep it to 3–5 sentences. Do not add a subject line or sign-off — just the message body.`,
		name,
		calculateAge(birthdayDate),
		birthdayDate.Format("January 2"),
		relationshipLine,
		notesLine,
		languageLine,
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
