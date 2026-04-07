package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

func InitDB(pool *pgxpool.Pool) {
	DB = pool
}

type CreatePersonRequest struct {
	Name         string `json:"name" binding:"required"`
	Relationship string `json:"relationship"`
	Notes        string `json:"notes"`
	Language     string `json:"language"`
}

func CreatePerson(c *gin.Context) {
	var req CreatePersonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, _ := c.Get("user_id")

	var id string
	err := DB.QueryRow(context.Background(),
		`INSERT INTO people (user_id, name, relationship, notes, language) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
		userID, req.Name, req.Relationship, req.Notes, req.Language,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}
