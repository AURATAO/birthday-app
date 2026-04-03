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
}

func CreatePerson(c *gin.Context) {
	var req CreatePersonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var id string
	err := DB.QueryRow(context.Background(),
		`INSERT INTO people (name, relationship, notes) VALUES ($1, $2, $3) RETURNING id`,
		req.Name, req.Relationship, req.Notes,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}
