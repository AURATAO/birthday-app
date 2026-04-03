package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

func InitDB(pool *pgxpool.Pool) {
	DB = pool
}

type Birthday struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	Birthday     string    `json:"birthday"`
	Relationship string    `json:"relationship"`
	Notes        string    `json:"notes"`
	CreatedAt    time.Time `json:"created_at"`
	DaysUntil    int       `json:"days_until"`
}

type CreateBirthdayRequest struct {
	Name         string `json:"name" binding:"required"`
	Birthday     string `json:"birthday" binding:"required"`
	Relationship string `json:"relationship"`
	Notes        string `json:"notes"`
}

func CreateBirthday(c *gin.Context) {
	var req CreateBirthdayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var id string
	err := DB.QueryRow(context.Background(),
		`INSERT INTO birthdays (name, birthday, relationship, notes) VALUES ($1, $2, $3, $4) RETURNING id`,
		req.Name, req.Birthday, req.Relationship, req.Notes,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func GetBirthdays(c *gin.Context) {
	rows, err := DB.Query(context.Background(), `
		SELECT id, name, birthday, relationship, notes, created_at,
		  CASE
		    WHEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM birthday)::int, EXTRACT(DAY FROM birthday)::int) >= CURRENT_DATE
		    THEN MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM birthday)::int, EXTRACT(DAY FROM birthday)::int) - CURRENT_DATE
		    ELSE MAKE_DATE(EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, EXTRACT(MONTH FROM birthday)::int, EXTRACT(DAY FROM birthday)::int) - CURRENT_DATE
		  END AS days_until
		FROM birthdays
		ORDER BY days_until ASC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var birthdays []Birthday
	for rows.Next() {
		var b Birthday
		var birthdayDate time.Time
		if err := rows.Scan(&b.ID, &b.Name, &birthdayDate, &b.Relationship, &b.Notes, &b.CreatedAt, &b.DaysUntil); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		b.Birthday = birthdayDate.Format("2006-01-02")
		birthdays = append(birthdays, b)
	}

	if birthdays == nil {
		birthdays = []Birthday{}
	}
	c.JSON(http.StatusOK, birthdays)
}
