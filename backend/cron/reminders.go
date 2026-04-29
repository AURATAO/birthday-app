package cron

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"birthday-app/handlers"

	"github.com/robfig/cron/v3"
)

type expoPushMessage struct {
	To         string         `json:"to"`
	Title      string         `json:"title"`
	Body       string         `json:"body"`
	Data       map[string]any `json:"data,omitempty"`
	CategoryID string         `json:"categoryId,omitempty"`
}

type reminderRow struct {
	eventID      string
	personName   string
	eventType    string
	emoji        string
	pushToken    string
	relationship string
	notes        string
	phone        string
	language     string
	eventTitle   string
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	Messages  []claudeMessage `json:"messages"`
}

type claudeContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type claudeResponse struct {
	Content []claudeContent `json:"content"`
}

// StartReminderCron registers daily 9 am jobs and starts the scheduler.
func StartReminderCron() {
	c := cron.New()

	// Tomorrow reminder — runs every day at 09:00
	c.AddFunc("0 9 * * *", runTomorrowReminders)

	// Today reminder — runs every day at 09:00
	c.AddFunc("0 9 * * *", runTodayReminders)

	c.Start()
	log.Println("Reminder cron started")
}

// runTomorrowReminders notifies users about events happening tomorrow.
func runTomorrowReminders() {
	log.Println("[reminders] checking tomorrow's events")

	rows, err := handlers.DB.Query(context.Background(), `
		SELECT p.name, e.id AS event_id, e.type, e.emoji, pt.token,
		       COALESCE(p.relationship, '') AS relationship,
		       COALESCE(p.notes, '') AS notes,
		       COALESCE(p.phone, '') AS phone,
		       COALESCE(p.language, '') AS language,
		       COALESCE(e.title, '') AS event_title
		FROM events e
		JOIN people p       ON p.id       = e.person_id
		JOIN push_tokens pt ON pt.user_id = e.user_id
		WHERE e.event_date = CURRENT_DATE + INTERVAL '1 day'
		  AND e.recurring  = true
		  AND p.deleted_at IS NULL
	`)
	if err != nil {
		log.Printf("[reminders] tomorrow query error: %v", err)
		return
	}
	defer rows.Close()

	var messages []expoPushMessage
	seen := map[string]bool{}
	for rows.Next() {
		var r reminderRow
		if err := rows.Scan(&r.personName, &r.eventID, &r.eventType, &r.emoji, &r.pushToken,
			&r.relationship, &r.notes, &r.phone, &r.language, &r.eventTitle); err != nil {
			log.Printf("[reminders] scan error: %v", err)
			continue
		}
		key := r.eventID + "|" + r.pushToken
		if seen[key] {
			continue
		}
		seen[key] = true

		cardID, message, err := preGenerateCard(r)
		if err != nil {
			log.Printf("[reminders] pre-generate error for event %s: %v", r.eventID, err)
			message = "Tap to write them a personal message"
		}

		data := map[string]any{
			"screen":   "card",
			"event_id": r.eventID,
		}
		if cardID != "" {
			data["card_id"] = cardID
			data["message"] = message
		}

		categoryID := "NO_PHONE"
		if r.phone != "" {
			data["phone"] = r.phone
			categoryID = "HAS_PHONE"
		}

		messages = append(messages, expoPushMessage{
			To:         r.pushToken,
			Title:      fmt.Sprintf("%s Tomorrow is %s's %s!", r.emoji, r.personName, r.eventType),
			Body:       message,
			Data:       data,
			CategoryID: categoryID,
		})
	}

	if len(messages) == 0 {
		log.Println("[reminders] no tomorrow reminders to send")
		return
	}

	if err := sendExpoPush(messages); err != nil {
		log.Printf("[reminders] push error: %v", err)
	} else {
		log.Printf("[reminders] sent %d tomorrow notification(s)", len(messages))
	}
}

// runTodayReminders notifies users about today's events where no card has been sent yet.
func runTodayReminders() {
	log.Println("[reminders] checking today's events")

	rows, err := handlers.DB.Query(context.Background(), `
		SELECT p.name, e.id AS event_id, e.type, e.emoji, pt.token,
		       COALESCE(p.relationship, '') AS relationship,
		       COALESCE(p.notes, '') AS notes,
		       COALESCE(p.phone, '') AS phone,
		       COALESCE(p.language, '') AS language,
		       COALESCE(e.title, '') AS event_title
		FROM events e
		JOIN people p       ON p.id       = e.person_id
		JOIN push_tokens pt ON pt.user_id = e.user_id
		WHERE e.event_date = CURRENT_DATE
		  AND e.recurring  = true
		  AND p.deleted_at IS NULL
		  AND NOT EXISTS (
		      SELECT 1 FROM cards c
		      WHERE c.event_id  = e.id
		        AND c.status    = $1
		        AND c.created_at::date = CURRENT_DATE
		  )
	`, "sent")
	if err != nil {
		log.Printf("[reminders] today query error: %v", err)
		return
	}
	defer rows.Close()

	var messages []expoPushMessage
	seen := map[string]bool{}
	for rows.Next() {
		var r reminderRow
		if err := rows.Scan(&r.personName, &r.eventID, &r.eventType, &r.emoji, &r.pushToken,
			&r.relationship, &r.notes, &r.phone, &r.language, &r.eventTitle); err != nil {
			log.Printf("[reminders] scan error: %v", err)
			continue
		}
		key := r.eventID + "|" + r.pushToken
		if seen[key] {
			continue
		}
		seen[key] = true

		cardID, message, err := preGenerateCard(r)
		if err != nil {
			log.Printf("[reminders] pre-generate error for event %s: %v", r.eventID, err)
			message = "Have you sent them a message yet?"
		}

		data := map[string]any{
			"screen":   "card",
			"event_id": r.eventID,
		}
		if cardID != "" {
			data["card_id"] = cardID
			data["message"] = message
		}

		categoryID := "NO_PHONE"
		if r.phone != "" {
			data["phone"] = r.phone
			categoryID = "HAS_PHONE"
		}

		messages = append(messages, expoPushMessage{
			To:         r.pushToken,
			Title:      fmt.Sprintf("%s Today is %s's special day!", r.emoji, r.personName),
			Body:       message,
			Data:       data,
			CategoryID: categoryID,
		})
	}

	if len(messages) == 0 {
		log.Println("[reminders] no today reminders to send")
		return
	}

	if err := sendExpoPush(messages); err != nil {
		log.Printf("[reminders] push error: %v", err)
	} else {
		log.Printf("[reminders] sent %d today notification(s)", len(messages))
	}
}

// preGenerateCard calls Claude to generate a message and saves it to the cards table.
// Returns the card ID and generated message text.
func preGenerateCard(r reminderRow) (string, string, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return "", "", fmt.Errorf("ANTHROPIC_API_KEY not set")
	}

	var eventDesc, toneGuide string
	switch r.eventType {
	case "milestone":
		desc := r.eventTitle
		if desc == "" {
			desc = "an important milestone"
		}
		eventDesc = fmt.Sprintf("Write an encouraging, supportive message for %s on the occasion of: %s.", r.personName, desc)
		toneGuide = "Lead with genuine belief in them. Warm and personal, like a close friend cheering them on. No generic motivational clichés."
	case "anniversary":
		eventDesc = fmt.Sprintf("Write a message for %s to mark their anniversary.", r.personName)
		toneGuide = "Deep warmth and appreciation for the time shared. Heartfelt, not cheesy."
	case "hard_date":
		desc := r.eventTitle
		if desc == "" {
			desc = "a difficult day"
		}
		eventDesc = fmt.Sprintf("Write a gentle, comforting message for %s — this is a hard date: %s.", r.personName, desc)
		toneGuide = "Gentle, soft, and present. No toxic positivity, no silver linings. Short is better."
	default: // birthday
		eventDesc = fmt.Sprintf("Write a warm, personal birthday message for %s.", r.personName)
		toneGuide = "Celebratory and warm, specific to this person. Personal and heartfelt, not generic."
	}

	relationshipLine := ""
	if r.relationship != "" {
		relationshipLine = fmt.Sprintf("\nRelationship to sender: %s", r.relationship)
	}
	notesLine := ""
	if r.notes != "" {
		notesLine = fmt.Sprintf("\nNotes about them: %s", r.notes)
	}
	languageLine := ""
	if r.language == "zh-TW" || r.language == "zh" {
		languageLine = "\nWrite in Traditional Chinese (繁體中文). Make it feel natural and warm, not like a translation."
	} else if r.language != "" && r.language != "en" {
		languageLine = fmt.Sprintf("\nWrite in this language: %s. Make it feel natural and warm, not like a translation.", r.language)
	}

	prompt := fmt.Sprintf(
		`%s%s%s%s
%s
Write the message directly to %s. Keep it to 3–5 sentences. No subject line or sign-off — just the message body.`,
		eventDesc,
		relationshipLine,
		notesLine,
		languageLine,
		toneGuide,
		r.personName,
	)

	reqBody, _ := json.Marshal(claudeRequest{
		Model:     "claude-haiku-4-5-20251001",
		MaxTokens: 512,
		Messages:  []claudeMessage{{Role: "user", Content: prompt}},
	})

	httpReq, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	if err != nil {
		return "", "", fmt.Errorf("build request: %w", err)
	}
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	httpReq.Header.Set("content-type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", "", fmt.Errorf("Claude request: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)

	var claudeResp claudeResponse
	if err := json.Unmarshal(respBytes, &claudeResp); err != nil || len(claudeResp.Content) == 0 {
		return "", "", fmt.Errorf("parse Claude response")
	}

	message := claudeResp.Content[0].Text

	var cardID string
	err = handlers.DB.QueryRow(context.Background(),
		`INSERT INTO cards (birthday_id, message, status) VALUES ($1, $2, $3) RETURNING id`,
		r.eventID, message, "pre_generated",
	).Scan(&cardID)
	if err != nil {
		return "", "", fmt.Errorf("save card: %w", err)
	}

	return cardID, message, nil
}

func sendExpoPush(messages []expoPushMessage) error {
	buf, err := json.Marshal(messages)
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://exp.host/--/api/v2/push/send", bytes.NewReader(buf))
	if err != nil {
		return fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("http do: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("expo returned status %d", resp.StatusCode)
	}
	return nil
}
