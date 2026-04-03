package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type ParseVoiceRequest struct {
	Transcript string `json:"transcript" binding:"required"`
}

type ParsedEvent struct {
	Name     string `json:"name"`
	Birthday string `json:"birthday"` // YYYY-MM-DD
	Type     string `json:"type"`     // birthday, anniversary, etc.
}

type claudeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type claudeRequest struct {
	Model     string          `json:"model"`
	MaxTokens int             `json:"max_tokens"`
	Messages  []claudeMessage `json:"messages"`
}

type claudeContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type claudeResponse struct {
	Content []claudeContent `json:"content"`
}

func ParseVoice(c *gin.Context) {
	var req ParseVoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ANTHROPIC_API_KEY not set"})
		return
	}

	prompt := fmt.Sprintf(
		`Extract event details from this voice transcript.
Respond with raw JSON only — no markdown, no code blocks, no explanation.
The JSON must have exactly three fields:
- "name" (string): the person's name
- "birthday" (string): the date in YYYY-MM-DD format, use %d if no year is mentioned
- "type" (string): the event type — one of "birthday", "anniversary", "graduation", "other" — default to "birthday" if unclear

If you cannot extract name and date, return {"name": "", "birthday": "", "type": "birthday"}.

Transcript: %s`,
		time.Now().Year(), req.Transcript,
	)

	reqBody, _ := json.Marshal(claudeRequest{
		Model:     "claude-haiku-4-5-20251001",
		MaxTokens: 256,
		Messages:  []claudeMessage{{Role: "user", Content: prompt}},
	})

	httpReq, err := http.NewRequest("POST", "https://api.anthropic.com/v1/messages", bytes.NewReader(reqBody))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build request: " + err.Error()})
		return
	}
	httpReq.Header.Set("x-api-key", apiKey)
	httpReq.Header.Set("anthropic-version", "2023-06-01")
	httpReq.Header.Set("content-type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Claude API request failed: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)

	var claudeResp claudeResponse
	if err := json.Unmarshal(respBytes, &claudeResp); err != nil || len(claudeResp.Content) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse Claude response"})
		return
	}

	text := strings.TrimSpace(claudeResp.Content[0].Text)
	// Strip markdown code fences if Claude ignored the prompt instruction
	if strings.HasPrefix(text, "```") {
		text = strings.TrimPrefix(text, "```json")
		text = strings.TrimPrefix(text, "```")
		text = strings.TrimSuffix(text, "```")
		text = strings.TrimSpace(text)
	}

	var parsed ParsedEvent
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Claude returned invalid JSON: " + text})
		return
	}

	c.JSON(http.StatusOK, parsed)
}
