// src/components/interview/AudioRecorder.jsx - Updated (Remove Info Box & Debug)
import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Send } from 'lucide-react';
import useStore from '../../store/useStore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import toast from 'react-hot-toast';



export default function AudioRecorder({ question, onAnswerSubmitted, chatAnswer = '' }) {
  const { interviewState, setInterviewState } = useStore();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);



  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const intervalRef = useRef(null);



  // Keep confirmed transcript in a ref to avoid stale closures
  const confirmedTranscriptRef = useRef('');
  // Track whether we should auto-restart recognition on 'end'
  const shouldRecognizeRef = useRef(false);



  // Firebase functions
  const speechToTextAdvanced = httpsCallable(functions, 'speechToTextAdvanced');
  const evaluateAnswerAsync = httpsCallable(functions, 'evaluateAnswerAsync');
  const saveAnswerToFirestore = httpsCallable(functions, 'saveAnswerToFirestore');



  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;



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
          setInterviewState({
            transcription: confirmedTranscriptRef.current,
          });
        } else {
          interimTranscript += transcript;
        }
      }



      setInterviewState({
        liveTranscript: confirmedTranscriptRef.current + interimTranscript,
      });
    };



    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
    };



    recognition.onend = () => {
      if (shouldRecognizeRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Handle restart errors gracefully
        }
      }
    };



    recognitionRef.current = recognition;



    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setInterviewState]);



  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });



      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });



      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];



      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };



      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm;codecs=opus',
        });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((t) => t.stop());
      };



      // Reset transcripts for a fresh answer
      confirmedTranscriptRef.current = '';
      setInterviewState({ transcription: '', liveTranscript: '' });



      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);



      // Start speech recognition
      if (recognitionRef.current) {
        shouldRecognizeRef.current = true;
        try {
          recognitionRef.current.start();
        } catch (e) {
          // "recognition has already started" — safe to ignore
        }
      }



      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);



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



      // Stop speech recognition + prevent auto-restart
      shouldRecognizeRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        // ignore
      }



      if (intervalRef.current) clearInterval(intervalRef.current);



      toast.success('Recording stopped');
    }
  };



  const playRecording = () => {
    if (!audioBlob) return;
    const url = URL.createObjectURL(audioBlob);
    const audio = new Audio(url);
    audio.play().catch((err) => {
      console.error('Error playing audio:', err);
      toast.error('Failed to play recording');
    });
  };



  const submitAnswer = async () => {
    if (!audioBlob && !interviewState.transcription?.trim() && !chatAnswer?.trim()) {
      toast.error('Please record an answer or provide a written response');
      return;
    }



    setIsProcessing(true);



    try {
      let browserTranscription = (interviewState.transcription || '').trim();
      let googleTranscription = '';
      let speechAnalysis = null;



      // Use Google STT for backend analysis when audio exists
      if (audioBlob) {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const audioData = reader.result.split(',')[1];
            
            // Call Google STT with advanced analysis
            console.log('Calling Google STT for advanced analysis...');
            const sttResult = await speechToTextAdvanced({
              audioData,
              sessionId: interviewState.sessionId,
              questionId: question.id
            });
            
            googleTranscription = (sttResult.data.transcription || '').trim();
            speechAnalysis = sttResult.data.speechAnalysis;
            
            console.log('Google STT completed with analysis:', speechAnalysis);
            await processAnswerWithAnalysis(browserTranscription, googleTranscription, speechAnalysis);
          } catch (error) {
            console.error('Google STT error:', error);
            toast.error('Advanced speech analysis failed, using browser transcription');
            await processAnswerWithAnalysis(browserTranscription, browserTranscription, null);
          }
        };
        reader.onerror = () => {
          console.error('FileReader error');
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
      
      if (!finalTranscription?.trim() && !chatAnswer?.trim()) {
        toast.error('No transcription or written answer available. Please try again.');
        setIsProcessing(false);
        return;
      }



      console.log('Saving answer for async evaluation...');
      console.log('Final transcription length:', finalTranscription.length);
      console.log('Written answer length:', chatAnswer?.length || 0);
      console.log('Speech analysis available:', !!speechAnalysis);



      // Convert audio to base64
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
          console.error('Error converting audio to base64:', e);
          audioData = null;
        }
      }



      const answerData = {
        questionId: question.id,
        question: question.question,
        verbalAnswer: finalTranscription,
        writtenAnswer: chatAnswer || '',
        browserTranscription: browserTranscription,
        googleTranscription: googleTranscription,
        speechAnalysisData: speechAnalysis,
        audioData,
        timestamp: new Date().toISOString(),
        recordingDuration: recordingTime,
        evaluationStatus: 'pending',
      };



      console.log('Saving answer to Firestore...');
      await saveAnswerToFirestore({
        sessionId: interviewState.sessionId,
        answerData,
      });



      console.log('Triggering async evaluation in background...');
      evaluateAnswerAsync({
        sessionId: interviewState.sessionId,
        questionId: question.id
      }).then(result => {
        console.log('Background evaluation completed successfully:', result.data);
        toast.success(`Question ${question.id} evaluated: Score ${result.data.score || 'N/A'}/20`, {
          duration: 2000,
          icon: '✅'
        });
      }).catch(error => {
        console.error('Background evaluation failed:', error);
        toast.error(`Question ${question.id} evaluation failed - will retry`, {
          duration: 2000,
          icon: '⚠️'
        });
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
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Answer</h3>



      {/* Controls */}
      <div className="flex items-center justify-center space-x-4 mb-6">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className="flex items-center space-x-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Mic className="h-5 w-5" />
            <span>Start Recording</span>
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center space-x-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-full transition-colors"
          >
            <Square className="h-5 w-5" />
            <span>Stop Recording</span>
          </button>
        )}



        {audioBlob && !isRecording && (
          <button
            onClick={playRecording}
            disabled={isProcessing}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="h-4 w-4" />
            <span>Play</span>
          </button>
        )}
      </div>



      {/* Timer */}
      {isRecording && (
        <div className="text-center mb-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-lg font-mono font-semibold text-red-600">
              {formatTime(recordingTime)}
            </span>
          </div>
          <p className="text-sm text-gray-500">Recording in progress...</p>
        </div>
      )}



      {/* Live Transcription */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Live Transcription
        </label>
        <div className="min-h-[100px] p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
          {interviewState.liveTranscript ? (
            <p className="text-gray-800 leading-relaxed">
              {interviewState.liveTranscript}
            </p>
          ) : (
            <p className="text-gray-500 italic">
              {isRecording
                ? 'Start speaking... your words will appear here'
                : 'No transcription yet'}
            </p>
          )}
        </div>
        {interviewState.liveTranscript && (
          <div className="mt-2 text-xs text-gray-500">
            {interviewState.liveTranscript.length} characters transcribed
          </div>
        )}
      </div>



      {/* Submit */}
      <button
        onClick={submitAnswer}
        disabled={(!audioBlob && !interviewState.transcription?.trim() && !chatAnswer?.trim()) || isProcessing}
        className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
            <span>Submitting Answer...</span>
          </>
        ) : (
          <>
            <Send className="h-5 w-5" />
            <span>Submit Answer & Continue</span>
          </>
        )}
      </button>
    </div>
  );
}
