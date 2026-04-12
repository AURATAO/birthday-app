package handlers

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
)

type SavePushTokenRequest struct {
	Token    string `json:"token" binding:"required"`
	Platform string `json:"platform" binding:"required"`
}

func SavePushToken(c *gin.Context) {
	userID, _ := c.Get("user_id")

	var req SavePushTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Upsert: one token row per (user_id, token) pair — update platform if it already exists.
	_, err := DB.Exec(context.Background(),
		`INSERT INTO push_tokens (user_id, token, platform)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id, token) DO UPDATE SET platform = EXCLUDED.platform`,
		userID, req.Token, req.Platform,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"ok": true})
}
