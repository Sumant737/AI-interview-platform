// src/components/interview/ProctoringOverlay.jsx - WITH EMOTION DISPLAY
import React from 'react';


// Emotion emoji mapping
const EMOTION_EMOJIS = {
  happy: '😊',
  sad: '😢',
  angry: '😠',
  surprised: '😮',
  fearful: '😰',
  neutral: '😐',
  disgusted: '🤢'
};


// Emotion color mapping
const EMOTION_COLORS = {
  happy: '#10B981',
  sad: '#6366F1',
  angry: '#EF4444',
  surprised: '#F59E0B',
  fearful: '#8B5CF6',
  neutral: '#6B7280',
  disgusted: '#EC4899'
};


export default function ProctoringOverlay({ warning, videoRef, currentEmotion, showEmotion = false }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 16,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'stretch',
      }}
    >
      {/* Proctoring Warning */}
      {warning && (
        <div
          style={{
            background: '#FFF8E1',
            color: '#7C3A00',
            border: '1px solid #F59E0B',
            borderRadius: 8,
            padding: '10px 12px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            maxWidth: 280,
          }}
        >
          ⚠️ {warning}
        </div>
      )}

      {/* Emotion Indicator - Only show if enabled and confidence is high enough */}
      {showEmotion && currentEmotion && currentEmotion.confidence > 0.3 && (
        <div
          style={{
            background: '#FFFFFF',
            border: `2px solid ${EMOTION_COLORS[currentEmotion.emotion] || '#6B7280'}`,
            borderRadius: 8,
            padding: '8px 12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 24 }}>
            {EMOTION_EMOJIS[currentEmotion.emotion] || '😐'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ 
              fontSize: 12, 
              fontWeight: 600,
              color: EMOTION_COLORS[currentEmotion.emotion] || '#6B7280',
              textTransform: 'capitalize'
            }}>
              {currentEmotion.emotion}
            </div>
            <div style={{ 
              fontSize: 10, 
              color: '#9CA3AF'
            }}>
              {Math.round(currentEmotion.confidence * 100)}% confidence
            </div>
          </div>
        </div>
      )}

      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        width={180}
        height={120}
        style={{
          background: '#000',
          borderRadius: 8,
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          objectFit: 'cover',
        }}
      />
    </div>
  );
}
