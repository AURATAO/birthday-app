package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type expoPushMessage struct {
	To    string         `json:"to"`
	Title string         `json:"title"`
	Body  string         `json:"body"`
	Data  map[string]any `json:"data,omitempty"`
}

type expoReceipt struct {
	Status  string `json:"status"`
	Message string `json:"message,omitempty"`
}

type expoPushResponse struct {
	Data []expoReceipt `json:"data"`
}

func TestNotification(c *gin.Context) {
	userID, _ := c.Get("user_id")

	// 1. Fetch push token
	var pushToken string
	err := DB.QueryRow(context.Background(),
		`SELECT token FROM push_tokens WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
		userID,
	).Scan(&pushToken)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no push token found for this user — open the app first to register"})
		return
	}

	// 2. Find the soonest upcoming event to use realistic data
	var eventID, personName string
	var eventDate time.Time
	err = DB.QueryRow(context.Background(), `
		SELECT e.id, p.name, e.event_date
		FROM events e
		JOIN people p ON p.id = e.person_id
		WHERE e.user_id = $1
		  AND p.deleted_at IS NULL
		ORDER BY
		  CASE
		    WHEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM e.event_date)::int, EXTRACT(DAY FROM e.event_date)::int) >= CURRENT_DATE
		    THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM e.event_date)::int, EXTRACT(DAY FROM e.event_date)::int)
		    ELSE MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, EXTRACT(MONTH FROM e.event_date)::int, EXTRACT(DAY FROM e.event_date)::int)
		  END ASC
		LIMIT 1`,
		userID,
	).Scan(&eventID, &personName, &eventDate)

	// Fall back to generic content if no events exist
	title := "Test notification 🎂"
	body := "Tap to create a personal card"
	if err == nil {
		title = fmt.Sprintf("Tomorrow is %s's birthday! 🎂", personName)
	}

	// 3. Send to Expo Push API
	payload := expoPushMessage{
		To:    pushToken,
		Title: title,
		Body:  body,
		Data:  map[string]any{"screen": "card", "event_id": eventID},
	}

	buf, _ := json.Marshal([]expoPushMessage{payload})
	req, _ := http.NewRequest(http.MethodPost, "https://exp.host/--/api/v2/push/send", bytes.NewReader(buf))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("expo push failed: %v", err)})
		return
	}
	defer resp.Body.Close()

	rawBody, _ := io.ReadAll(resp.Body)

	var expoResp expoPushResponse
	if jsonErr := json.Unmarshal(rawBody, &expoResp); jsonErr != nil {
		// Return raw response so it's still useful for debugging
		c.JSON(http.StatusBadGateway, gin.H{
			"error": "could not parse expo response",
			"raw":   string(rawBody),
		})
		return
	}

	// 4. Report back
	if len(expoResp.Data) > 0 && expoResp.Data[0].Status == "ok" {
		c.JSON(http.StatusOK, gin.H{
			"ok":         true,
			"push_token": pushToken,
			"title":      title,
			"body":       body,
			"event_id":   eventID,
		})
	} else {
		errMsg := "unknown error from expo"
		if len(expoResp.Data) > 0 {
			errMsg = expoResp.Data[0].Message
		}
		c.JSON(http.StatusOK, gin.H{
			"ok":         false,
			"expo_error": errMsg,
			"push_token": pushToken,
			"raw":        string(rawBody),
		})
	}
}
