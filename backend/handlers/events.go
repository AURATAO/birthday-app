package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type CreateEventRequest struct {
	PersonID   string `json:"person_id" binding:"required"`
	Type       string `json:"type"`
	EventDate  string `json:"event_date" binding:"required"`
	Title      string `json:"title"`
	Emoji      string `json:"emoji"`
	RemindDays *int   `json:"remind_days"`
	Recurring  *bool  `json:"recurring"`
}

type UpcomingEvent struct {
	ID           string `json:"id"`
	PersonID     string `json:"person_id"`
	Name         string `json:"name"`
	Relationship string `json:"relationship"`
	Phone        string `json:"phone"`
	Birthday     string `json:"birthday"` // event_date, named for frontend compatibility
	EventType    string `json:"event_type"`
	Emoji        string `json:"emoji"`
	Title        string `json:"title"`
	DaysUntil    int    `json:"days_until"`
	RemindDays   int    `json:"remind_days"`
}

type UpdateEventRequest struct {
	Recurring *bool `json:"recurring"`
}

func UpdateEvent(c *gin.Context) {
	eventID := c.Param("id")
	userID, _ := c.Get("user_id")

	var req UpdateEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Recurring == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "recurring field required"})
		return
	}

	tag, err := DB.Exec(context.Background(),
		`UPDATE events SET recurring = $1 WHERE id = $2 AND user_id = $3`,
		*req.Recurring, eventID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "event not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func CreateEvent(c *gin.Context) {
	var req CreateEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Type == "" {
		req.Type = "birthday"
	}
	remindDays := 7
	if req.RemindDays != nil {
		remindDays = *req.RemindDays
	}
	recurring := true
	if req.Recurring != nil {
		recurring = *req.Recurring
	}

	userID, _ := c.Get("user_id")

	var id string
	err := DB.QueryRow(context.Background(),
		`INSERT INTO events (user_id, person_id, type, event_date, title, emoji, remind_days, recurring)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		 RETURNING id`,
		userID, req.PersonID, req.Type, req.EventDate, req.Title, req.Emoji, remindDays, recurring,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func GetEvent(c *gin.Context) {
	id := c.Param("id")
	var ev UpcomingEvent
	var eventDate time.Time
	err := DB.QueryRow(context.Background(),
		`SELECT e.id, p.name, p.relationship, COALESCE(p.phone, ''), e.event_date, e.type, e.remind_days, COALESCE(e.emoji, '') AS emoji
		 FROM events e
		 JOIN people p ON p.id = e.person_id
		 WHERE e.id = $1`,
		id,
	).Scan(&ev.ID, &ev.Name, &ev.Relationship, &ev.Phone, &eventDate, &ev.EventType, &ev.RemindDays, &ev.Emoji)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "event not found"})
		return
	}
	ev.Birthday = eventDate.Format("2006-01-02")
	c.JSON(http.StatusOK, ev)
}

func GetUpcomingEvents(c *gin.Context) {
	userID, _ := c.Get("user_id")

	rows, err := DB.Query(context.Background(), `
		SELECT
		  e.id,
		  p.id AS person_id,
		  p.name,
		  p.relationship,
		  e.event_date,
		  e.type AS event_type,
		  COALESCE(e.emoji, '') AS emoji,
		  COALESCE(e.title, '') AS event_title,
		  e.remind_days,
		  CASE
		    WHEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM e.event_date)::int, EXTRACT(DAY FROM e.event_date)::int) >= CURRENT_DATE
		    THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM e.event_date)::int, EXTRACT(DAY FROM e.event_date)::int) - CURRENT_DATE
		    ELSE MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, EXTRACT(MONTH FROM e.event_date)::int, EXTRACT(DAY FROM e.event_date)::int) - CURRENT_DATE
		  END AS days_until
		FROM events e
		JOIN people p ON p.id = e.person_id
		WHERE e.user_id = $1
		  AND p.deleted_at IS NULL
		ORDER BY days_until ASC
	`, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var events []UpcomingEvent
	for rows.Next() {
		var ev UpcomingEvent
		var eventDate time.Time
		if err := rows.Scan(&ev.ID, &ev.PersonID, &ev.Name, &ev.Relationship, &eventDate, &ev.EventType, &ev.Emoji, &ev.Title, &ev.RemindDays, &ev.DaysUntil); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		ev.Birthday = eventDate.Format("2006-01-02")
		events = append(events, ev)
	}

	if events == nil {
		events = []UpcomingEvent{}
	}
	c.JSON(http.StatusOK, events)
}
