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
	Phone        string `json:"phone"`
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
		`INSERT INTO people (user_id, name, relationship, notes, phone, language) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		userID, req.Name, req.Relationship, req.Notes, req.Phone, req.Language,
	).Scan(&id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

type UpdatePersonRequest struct {
	Name         string `json:"name"`
	Relationship string `json:"relationship"`
	Notes        string `json:"notes"`
	Phone        string `json:"phone"`
}

func UpdatePerson(c *gin.Context) {
	personID := c.Param("id")
	userID, _ := c.Get("user_id")

	var req UpdatePersonRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tag, err := DB.Exec(context.Background(),
		`UPDATE people SET name=$1, relationship=$2, notes=$3, phone=$4
		 WHERE id=$5 AND user_id=$6`,
		req.Name, req.Relationship, req.Notes, req.Phone, personID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "person not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}

func DeletePerson(c *gin.Context) {
	personID := c.Param("id")
	userID, _ := c.Get("user_id")

	tag, err := DB.Exec(context.Background(),
		`UPDATE people SET deleted_at = NOW()
		 WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
		personID, userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tag.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "person not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
