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
	eventID   string
	personName string
	pushToken  string
}

// StartReminderCron registers daily 9 am jobs and starts the scheduler.
func StartReminderCron() {
	c := cron.New()

	// Tomorrow-reminder: runs every day at 09:00
	c.AddFunc("0 9 * * *", func() {
		runReminders(1, "tomorrow")
	})

	// Same-day reminder: runs every day at 09:00 — same schedule, different offset
	// We use two separate entries so each can be tweaked independently later.
	c.AddFunc("0 9 * * *", func() {
		runReminders(0, "today")
	})

	c.Start()
	log.Println("Reminder cron started")
}

// runReminders queries events whose month/day matches today+offsetDays, then
// sends a push notification to the event owner for each match.
func runReminders(offsetDays int, label string) {
	target := time.Now().AddDate(0, 0, offsetDays)
	month := int(target.Month())
	day := target.Day()

	log.Printf("[reminders] checking %s (month=%d day=%d)", label, month, day)

	rows, err := handlers.DB.Query(context.Background(), `
		SELECT e.id, p.name, pt.token
		FROM events e
		JOIN people p  ON p.id  = e.person_id
		JOIN push_tokens pt ON pt.user_id = e.user_id
		WHERE EXTRACT(MONTH FROM e.event_date)::int = $1
		  AND EXTRACT(DAY   FROM e.event_date)::int = $2
		  AND p.deleted_at IS NULL
	`, month, day)
	if err != nil {
		log.Printf("[reminders] query error: %v", err)
		return
	}
	defer rows.Close()

	var reminders []reminderRow
	seen := map[string]bool{} // deduplicate (event_id, token) pairs
	for rows.Next() {
		var r reminderRow
		if err := rows.Scan(&r.eventID, &r.personName, &r.pushToken); err != nil {
			log.Printf("[reminders] scan error: %v", err)
			continue
		}
		key := r.eventID + "|" + r.pushToken
		if seen[key] {
			continue
		}
		seen[key] = true
		reminders = append(reminders, r)
	}

	if len(reminders) == 0 {
		log.Printf("[reminders] no %s reminders to send", label)
		return
	}

	var messages []expoPushMessage
	for _, r := range reminders {
		var title, body string
		if offsetDays == 0 {
			title = fmt.Sprintf("Today is %s's birthday! 🎉", r.personName)
			body = "Have you sent them a card yet?"
		} else {
			title = fmt.Sprintf("Tomorrow is %s's birthday! 🎂", r.personName)
			body = "Tap to create a personal card for them"
		}
		messages = append(messages, expoPushMessage{
			To:    r.pushToken,
			Title: title,
			Body:  body,
			Data: map[string]any{
				"event_id": r.eventID,
				"screen":   "card",
			},
		})
	}

	if err := sendExpoPush(messages); err != nil {
		log.Printf("[reminders] push error: %v", err)
	} else {
		log.Printf("[reminders] sent %d %s notification(s)", len(messages), label)
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
