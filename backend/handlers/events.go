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
	RemindDays *int   `json:"remind_days"`
	Recurring  *bool  `json:"recurring"`
}

type UpcomingEvent struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Relationship string `json:"relationship"`
	Birthday     string `json:"birthday"` // event_date, named for frontend compatibility
	EventType    string `json:"event_type"`
	DaysUntil    int    `json:"days_until"`
	RemindDays   int    `json:"remind_days"`
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

	var id string
	err := DB.QueryRow(context.Background(),
		`INSERT INTO events (person_id, type, event_date, title, remind_days, recurring)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id`,
		req.PersonID, req.Type, req.EventDate, req.Title, remindDays, recurring,
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
		`SELECT e.id, p.name, p.relationship, e.event_date, e.type, e.remind_days
		 FROM events e
		 JOIN people p ON p.id = e.person_id
		 WHERE e.id = $1`,
		id,
	).Scan(&ev.ID, &ev.Name, &ev.Relationship, &eventDate, &ev.EventType, &ev.RemindDays)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "event not found"})
		return
	}
	ev.Birthday = eventDate.Format("2006-01-02")
	c.JSON(http.StatusOK, ev)
}

func GetUpcomingEvents(c *gin.Context) {
	rows, err := DB.Query(context.Background(), `
		SELECT
		  e.id,
		  p.name,
		  p.relationship,
		  e.event_date,
		  e.type AS event_type,
		  e.remind_days,
		  CASE
		    WHEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM e.event_date)::int, EXTRACT(DAY FROM e.event_date)::int) >= CURRENT_DATE
		    THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM e.event_date)::int, EXTRACT(DAY FROM e.event_date)::int) - CURRENT_DATE
		    ELSE MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, EXTRACT(MONTH FROM e.event_date)::int, EXTRACT(DAY FROM e.event_date)::int) - CURRENT_DATE
		  END AS days_until
		FROM events e
		JOIN people p ON p.id = e.person_id
		ORDER BY days_until ASC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var events []UpcomingEvent
	for rows.Next() {
		var ev UpcomingEvent
		var eventDate time.Time
		if err := rows.Scan(&ev.ID, &ev.Name, &ev.Relationship, &eventDate, &ev.EventType, &ev.RemindDays, &ev.DaysUntil); err != nil {
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
