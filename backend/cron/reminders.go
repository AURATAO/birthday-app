package cron

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"birthday-app/handlers"

	"github.com/robfig/cron/v3"
)

type expoPushMessage struct {
	To    string         `json:"to"`
	Title string         `json:"title"`
	Body  string         `json:"body"`
	Data  map[string]any `json:"data,omitempty"`
}

type reminderRow struct {
	eventID    string
	personName string
	eventType  string
	emoji      string
	pushToken  string
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
		SELECT p.name, e.id AS event_id, e.type, e.emoji, pt.token
		FROM events e
		JOIN people p      ON p.id       = e.person_id
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
		if err := rows.Scan(&r.personName, &r.eventID, &r.eventType, &r.emoji, &r.pushToken); err != nil {
			log.Printf("[reminders] scan error: %v", err)
			continue
		}
		key := r.eventID + "|" + r.pushToken
		if seen[key] {
			continue
		}
		seen[key] = true

		messages = append(messages, expoPushMessage{
			To:    r.pushToken,
			Title: fmt.Sprintf("%s Tomorrow is %s's %s!", r.emoji, r.personName, r.eventType),
			Body:  "Tap to create a personal message",
			Data: map[string]any{
				"screen":   "card",
				"event_id": r.eventID,
			},
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
		SELECT p.name, e.id AS event_id, e.type, e.emoji, pt.token
		FROM events e
		JOIN people p      ON p.id       = e.person_id
		JOIN push_tokens pt ON pt.user_id = e.user_id
		WHERE e.event_date = CURRENT_DATE
		  AND e.recurring  = true
		  AND p.deleted_at IS NULL
		  AND NOT EXISTS (
		      SELECT 1 FROM cards c
		      WHERE c.event_id  = e.id
		        AND c.status    = 'sent'
		        AND c.created_at::date = CURRENT_DATE
		  )
	`)
	if err != nil {
		log.Printf("[reminders] today query error: %v", err)
		return
	}
	defer rows.Close()

	var messages []expoPushMessage
	seen := map[string]bool{}
	for rows.Next() {
		var r reminderRow
		if err := rows.Scan(&r.personName, &r.eventID, &r.eventType, &r.emoji, &r.pushToken); err != nil {
			log.Printf("[reminders] scan error: %v", err)
			continue
		}
		key := r.eventID + "|" + r.pushToken
		if seen[key] {
			continue
		}
		seen[key] = true

		messages = append(messages, expoPushMessage{
			To:    r.pushToken,
			Title: fmt.Sprintf("%s Today is %s's special day!", r.emoji, r.personName),
			Body:  "Have you sent them a message yet?",
			Data: map[string]any{
				"screen":   "card",
				"event_id": r.eventID,
			},
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
