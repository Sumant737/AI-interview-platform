// src/components/interview/InterviewLayout.jsx - Unified Interview Layout (Fixed 2-column)
import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, Volume2, Mic, Square, Send, Code } from 'lucide-react';
import useStore from '../../store/useStore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import toast from 'react-hot-toast';
import interviewerImage from '../../assets/interviewer.png';

export default function InterviewLayout({ 
  layout = 'standard', // 'standard' | 'written'
  question, 
  questionNumber, 
  totalQuestions, 
  videoRef,
  onAnswerSubmitted,
  currentChatAnswer,
  setCurrentChatAnswer
}) {
  const { interviewState, setInterviewState } = useStore();
  const isWrittenMode = layout === 'written';
  
  // Question audio states
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [audioElement, setAudioElement] = useState(null);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const hasInitialized = useRef(false);
  const autoPlayTimeout = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const intervalRef = useRef(null);
  const confirmedTranscriptRef = useRef('');
  const shouldRecognizeRef = useRef(false);
  
  const generateTTS = httpsCallable(functions, 'textToSpeech');
  const speechToTextAdvanced = httpsCallable(functions, 'speechToTextAdvanced');
  const evaluateAnswerAsync = httpsCallable(functions, 'evaluateAnswerAsync');
  const saveAnswerToFirestore = httpsCallable(functions, 'saveAnswerToFirestore');

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not available in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          confirmedTranscriptRef.current += transcript;
          setInterviewState({ transcription: confirmedTranscriptRef.current });
        } else {
          interimTranscript += transcript;
        }
      }
      setInterviewState({ liveTranscript: confirmedTranscriptRef.current + interimTranscript });
    };

    recognition.onerror = (event) => console.error('Speech recognition error:', event.error);
    recognition.onend = () => {
      if (shouldRecognizeRef.current) {
        try { recognition.start(); } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try { recognitionRef.current?.stop(); } catch {}
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setInterviewState]);

  // Initialize audio for question
  useEffect(() => {
    if (autoPlayTimeout.current) clearTimeout(autoPlayTimeout.current);
    setHasAutoPlayed(false);
    if (isWrittenMode && setCurrentChatAnswer) setCurrentChatAnswer('');
    setIsPlaying(false);
    hasInitialized.current = false;
    
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setAudioElement(null);
    }

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      initializeAudio();
    }

    return () => {
      if (autoPlayTimeout.current) clearTimeout(autoPlayTimeout.current);
      if (audioElement) {
        audioElement.pause();
        audioElement.currentTime = 0;
      }
    };
  }, [question.id]);

  const initializeAudio = () => {
    if (question.audioUrl) {
      setAudioUrl(question.audioUrl);
      autoPlayTimeout.current = setTimeout(() => {
        if (!hasAutoPlayed && !isPlaying) autoPlayAudio(question.audioUrl);
      }, 800);
    } else {
      generateQuestionAudio();
    }
  };

  const generateQuestionAudio = async () => {
    if (!question.question || loading) return;
    setLoading(true);
    try {
      const result = await generateTTS({
        text: question.question,
        questionId: question.id,
        sessionId: interviewState.sessionId
      });
      setAudioUrl(result.data.audioUrl);
      autoPlayTimeout.current = setTimeout(() => {
        if (!hasAutoPlayed && !isPlaying) autoPlayAudio(result.data.audioUrl);
      }, 500);
    } catch (error) {
      console.error('Error generating TTS:', error);
    } finally {
      setLoading(false);
    }
  };

  const autoPlayAudio = (url) => {
    if (!url || hasAutoPlayed || isPlaying) return;
    setHasAutoPlayed(true);
    playAudioWithUrl(url);
  };

  const playAudio = () => {
    if (!audioUrl) return;
    playAudioWithUrl(audioUrl);
  };

  const playAudioWithUrl = (url) => {
    if (!url || isPlaying) return;
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
    }

    const audio = new Audio(url);
    setAudioElement(audio);
    setIsPlaying(true);
    
    audio.onended = () => { setIsPlaying(false); setAudioElement(null); };
    audio.onerror = () => { setIsPlaying(false); setAudioElement(null); };
    audio.onpause = () => setIsPlaying(false);
    
    audio.play().catch(() => { setIsPlaying(false); setAudioElement(null); });
  };

  const stopAudio = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setIsPlaying(false);
      setAudioElement(null);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };
      
      confirmedTranscriptRef.current = '';
      setInterviewState({ transcription: '', liveTranscript: '' });
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      
      if (recognitionRef.current) {
        shouldRecognizeRef.current = true;
        try { recognitionRef.current.start(); } catch (e) {}
      }
      
      intervalRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
      toast.success('Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Failed to start recording. Please check microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      shouldRecognizeRef.current = false;
      try { recognitionRef.current?.stop(); } catch (e) {}
      if (intervalRef.current) clearInterval(intervalRef.current);
      toast.success('Recording stopped');
    }
  };

  const submitAnswer = async () => {
    const hasWrittenAnswer = isWrittenMode && currentChatAnswer?.trim();
    const hasVerbalAnswer = audioBlob || interviewState.transcription?.trim();
    
    if (!hasWrittenAnswer && !hasVerbalAnswer) {
      toast.error(isWrittenMode ? 'Please record an answer or provide a written response' : 'Please record an answer');
      return;
    }

    setIsProcessing(true);

    try {
      let browserTranscription = (interviewState.transcription || '').trim();
      let googleTranscription = '';
      let speechAnalysis = null;

      if (audioBlob) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const audioData = reader.result.split(',')[1];
            const sttResult = await speechToTextAdvanced({
              audioData,
              sessionId: interviewState.sessionId,
              questionId: question.id
            });
            googleTranscription = (sttResult.data.transcription || '').trim();
            speechAnalysis = sttResult.data.speechAnalysis;
            await processAnswerWithAnalysis(browserTranscription, googleTranscription, speechAnalysis);
          } catch (error) {
            console.error('Google STT error:', error);
            await processAnswerWithAnalysis(browserTranscription, browserTranscription, null);
          }
        };
        reader.onerror = () => {
          toast.error('Failed to read audio data');
          setIsProcessing(false);
        };
        reader.readAsDataURL(audioBlob);
      } else {
        await processAnswerWithAnalysis(browserTranscription, browserTranscription, null);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      toast.error('Failed to submit answer');
      setIsProcessing(false);
    }
  };

  const processAnswerWithAnalysis = async (browserTranscription, googleTranscription, speechAnalysis) => {
    try {
      const finalTranscription = googleTranscription || browserTranscription;
      const writtenAnswer = isWrittenMode ? (currentChatAnswer || '') : '';
      
      if (!finalTranscription?.trim() && !writtenAnswer?.trim()) {
        toast.error('No transcription or written answer available. Please try again.');
        setIsProcessing(false);
        return;
      }

      let audioData = null;
      if (audioBlob) {
        try {
          const reader = new FileReader();
          audioData = await new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });
        } catch (e) {
          audioData = null;
        }
      }

      const answerData = {
        questionId: question.id,
        question: question.question,
        verbalAnswer: finalTranscription,
        writtenAnswer: writtenAnswer,
        browserTranscription: browserTranscription,
        googleTranscription: googleTranscription,
        speechAnalysisData: speechAnalysis,
        audioData,
        timestamp: new Date().toISOString(),
        recordingDuration: recordingTime,
        evaluationStatus: 'pending',
      };

      await saveAnswerToFirestore({
        sessionId: interviewState.sessionId,
        answerData,
      });

      evaluateAnswerAsync({
        sessionId: interviewState.sessionId,
        questionId: question.id
      }).then(result => {
        toast.success(`Question ${question.id} evaluated: Score ${result.data.score || 'N/A'}/20`, {
          duration: 2000,
          icon: '✅'
        });
      }).catch(error => {
        console.error('Background evaluation failed:', error);
      });

      const nextQuestionIndex = interviewState.currentQuestion + 1;
      const updatedAnswers = [...interviewState.answers, answerData];

      setInterviewState({
        answers: updatedAnswers,
        currentQuestion: nextQuestionIndex,
        transcription: '',
        liveTranscript: '',
      });

      setAudioBlob(null);
      setRecordingTime(0);

      setTimeout(() => onAnswerSubmitted(answerData), 100);
      toast.success('Answer submitted! Moving to next question...', {
        icon: '🚀',
        duration: 2000
      });
      
    } catch (error) {
      console.error('Error processing answer:', error);
      toast.error('Failed to submit answer. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

   return (
  <div className={`h-[calc(100vh-120px)] grid gap-0 ${isWrittenMode ? 'grid-cols-3' : 'grid-cols-2'}`}>
    {/* LEFT COLUMN - AI INTERVIEWER & QUESTION */}
    <div className={`bg-gray-800 flex flex-col ${isWrittenMode ? 'border-r border-gray-700' : ''}`}>
      {/* AI Avatar/Video - CAMERA STYLE */}
      {isWrittenMode ? (
        // Written mode: compact video-style (40% height)
        <div className="bg-black p-4" style={{ height: '40%' }}>
          <div className="relative w-full h-full">
            <img 
              src={interviewerImage} 
              alt="AI Interviewer" 
              className="w-full h-full object-cover rounded-lg shadow-2xl"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded">
              <span className="text-white text-xs font-medium">AI Interviewer</span>
            </div>
            {/* Optional: Live indicator */}
            <div className="absolute top-2 left-2 flex items-center space-x-1 bg-red-600 px-2 py-1 rounded">
              <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-xs font-semibold">LIVE</span>
            </div>
          </div>
        </div>
      ) : (
        // Standard mode: large video-style (50% height)
        <div className="bg-black p-6" style={{ height: '50%' }}>
          <div className="relative w-full h-full max-w-3xl mx-auto">
            <img 
              src={interviewerImage} 
              alt="AI Interviewer" 
              className="w-full h-full object-cover rounded-lg shadow-2xl"
            />
            <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-2 rounded-lg">
              <span className="text-white text-sm font-medium">AI Interviewer</span>
            </div>
            {/* Optional: Live indicator */}
            <div className="absolute top-4 left-4 flex items-center space-x-2 bg-red-600 px-3 py-1 rounded-lg">
              <div className="h-2 w-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-semibold">LIVE</span>
            </div>
          </div>
        </div>
      )}

      {/* Question Panel */}
      <div className="flex-1 bg-gray-900 p-6 border-t border-gray-700 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className={`${isWrittenMode ? 'text-base' : 'text-lg'} font-semibold text-white`}>
            Question {questionNumber}{isWrittenMode ? '/' : ' of '}{totalQuestions}
          </h3>
            <span className={
            isWrittenMode 
                ? 'px-2 py-1 bg-purple-900 text-purple-200 text-xs rounded-full capitalize flex items-center space-x-1'
                : 'px-3 py-1 bg-blue-900 text-blue-200 text-sm rounded-full capitalize'
            }>
            {isWrittenMode && <Code className="h-3 w-3" />}
            <span>{question.type}</span>
            </span>

        </div>

        <p className={`${isWrittenMode ? 'text-lg' : 'text-xl'} text-gray-100 leading-relaxed mb-6`}>
          {question.question}
        </p>

        {/* Audio Controls */}
        <div className={isWrittenMode ? 'space-y-2' : 'flex items-center space-x-4'}>
          {!isPlaying ? (
            <button
              onClick={playAudio}
              disabled={!audioUrl || loading}
              className={`${isWrittenMode ? 'w-full' : ''} flex items-center ${isWrittenMode ? 'justify-center' : ''} space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50`}
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="text-sm">{loading ? 'Loading...' : hasAutoPlayed ? 'Listen Again' : 'Listen'}</span>
            </button>
          ) : (
            <button
              onClick={stopAudio}
              className={`${isWrittenMode ? 'w-full' : ''} flex items-center ${isWrittenMode ? 'justify-center' : ''} space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors`}
            >
              <Pause className="h-4 w-4" />
              <span className="text-sm">Stop</span>
            </button>
          )}
          
          {isPlaying && (
            <div className={`flex items-center ${isWrittenMode ? 'justify-center mt-2' : ''} space-x-2 text-blue-400`}>
              <Volume2 className="h-4 w-4 animate-pulse" />
              <span className="text-sm">Playing...</span>
            </div>
          )}
        </div>
      </div>
    </div>


      {/* MIDDLE COLUMN - WRITTEN ANSWER (Only in Written Mode) */}
      {isWrittenMode && (
        <div className="bg-gray-900 flex flex-col border-r border-gray-700">
          <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center space-x-2">
            <Code className="h-5 w-5 text-purple-400" />
            <h3 className="text-sm font-semibold text-white">Written Answer / Code</h3>
          </div>
          
          <div className="flex-1 p-0">
            <textarea
              value={currentChatAnswer}
              onChange={(e) => setCurrentChatAnswer(e.target.value)}
              placeholder={
                question.question.toLowerCase().includes('code') 
                  ? "// Write your code here...\n// You can use any programming language\n\nfunction solution() {\n  // Your implementation\n}"
                  : "Write your detailed answer here...\n\nYou can structure your response with:\n- Key points\n- Explanations\n- Examples"
              }
              className="w-full h-full p-6 bg-gray-900 text-gray-100 border-0 resize-none focus:outline-none focus:ring-0 font-mono text-sm leading-relaxed"
              style={{ 
                fontFamily: question.question.toLowerCase().includes('code') ? 'Monaco, Menlo, Consolas, monospace' : 'inherit'
              }}
            />
          </div>
          
          <div className="bg-gray-800 px-4 py-2 border-t border-gray-700 flex justify-between items-center">
            <span className="text-xs text-gray-400">
              {currentChatAnswer?.length || 0} characters
            </span>
            <span className="text-xs text-gray-500">
              {question.question.toLowerCase().includes('code') ? 'Code Editor Mode' : 'Text Editor Mode'}
            </span>
          </div>
        </div>
      )}

      {/* RIGHT COLUMN - CANDIDATE VIDEO & CONTROLS */}
      <div className="bg-gray-900 flex flex-col">
        {/* User Video Feed */}
        {isWrittenMode ? (
          // Written mode: compact video (40% height)
          <div className="flex items-center justify-center bg-black p-4" style={{ height: '40%' }}>
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover rounded-lg shadow-2xl"
              />
              <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 px-2 py-1 rounded">
                <span className="text-white text-xs font-medium">You</span>
              </div>
            </div>
          </div>
        ) : (
          // Standard mode: large prominent video (50% height)
          <div className="flex items-center justify-center bg-black p-6" style={{ height: '50%' }}>
            <div className="relative w-full h-full max-w-3xl">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover rounded-lg shadow-2xl"
              />
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-70 px-3 py-2 rounded-lg">
                <span className="text-white text-sm font-medium">You</span>
              </div>
            </div>
          </div>
        )}

        {/* Transcription & Controls Panel */}
        <div className="flex-1 bg-gray-800 p-6 border-t border-gray-700 flex flex-col">
          {isWrittenMode && (
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-white mb-2">Verbal Explanation</h3>
            </div>
          )}
          
          {/* Recording Controls */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            {!isRecording ? (
              <button
                onClick={startRecording}
                disabled={isProcessing}
                className={`flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors disabled:opacity-50`}
              >
                <Mic className="h-5 w-5" />
                <span>{isWrittenMode ? 'Record' : 'Start Recording'}</span>
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className={`flex items-center space-x-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-full transition-colors`}
              >
                <Square className="h-5 w-5" />
                <span>{isWrittenMode ? 'Stop' : 'Stop Recording'}</span>
              </button>
            )}
          </div>

          {/* Timer */}
          {isRecording && (
            <div className="text-center mb-4">
              <div className="flex items-center justify-center space-x-2">
                <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-lg font-mono font-semibold text-red-400">
                  {formatTime(recordingTime)}
                </span>
              </div>
            </div>
          )}

          {/* Live Transcription */}
          <div className="flex-1 flex flex-col mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {isWrittenMode ? 'Live Transcription' : 'Your Answer (Live Transcription)'}
            </label>
            <div className="flex-1 min-h-[120px] overflow-y-auto p-4 border-2 border-gray-700 rounded-lg bg-gray-900">
              {interviewState.liveTranscript ? (
                <p className="text-gray-100 leading-relaxed">
                  {interviewState.liveTranscript}
                </p>
              ) : (
                <p className="text-gray-500 italic">
                  {isRecording ? (isWrittenMode ? 'Speak to see transcription...' : 'Start speaking... your words will appear here') : 'No transcription yet'}
                </p>
              )}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={submitAnswer}
            disabled={(!audioBlob && !interviewState.transcription?.trim() && (!isWrittenMode || !currentChatAnswer?.trim())) || isProcessing}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>{isWrittenMode ? 'Submitting...' : 'Submitting Answer...'}</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                <span>{isWrittenMode ? 'Submit Answer' : 'Submit Answer & Continue'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
