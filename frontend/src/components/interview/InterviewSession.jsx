// src/components/interview/InterviewSession.jsx - Real Interview Style Layout
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { functions, auth, db } from '../../firebase';
import useStore from '../../store/useStore';
import InterviewLayout from './InterviewLayout';
import useProctoring from './useProctoring';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, Clock, User } from 'lucide-react';

export default function InterviewSession() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const {
    applicationData,
    interviewState,
    setInterviewState,
    setApplicationData,
    resetInterview,
    hasActiveSession,
    resumeSession,
    canAttemptTemplate,
    setCameraState,
    stopCamera,
    refreshTemplateData // ✅ CORRECT - Inside component
  } = useStore();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentChatAnswer, setCurrentChatAnswer] = useState('');

  // Proctoring event helpers for Zustand
  function setStoreWarning(type) {
    setInterviewState({ proctorWarning: type });
  }
  function addProctorEvent(event) {
    setInterviewState({
      proctoringEvents: [
        ...(interviewState.proctoringEvents || []),
        event
      ]
    });
  }

  // Activate proctoring with emotion detection
  const { 
    warning, 
    videoRef, 
    initialized,
    currentEmotion,
    emotionHistory
  } = useProctoring({
    setStoreWarning,
    addProctorEvent
  });

  // Firebase functions
  const processApplication = httpsCallable(functions, 'processApplication');
  const createInterviewSession = httpsCallable(functions, 'createInterviewSession');
  const generateReport = httpsCallable(functions, 'generateReport');
  const textToSpeech = httpsCallable(functions, 'textToSpeech');

  useEffect(() => {
    initializeInterview();
    
    return () => {
      stopCamera();
    };
  }, [templateId]);

  const initializeInterview = async () => {
    try {
      setLoading(true);

      if (hasActiveSession() && interviewState.templateId === templateId) {
        console.log('Resuming existing session:', interviewState.sessionId);
        
        try {
          const sessionDoc = await getDoc(doc(db, 'sessions', interviewState.sessionId));
          if (sessionDoc.exists()) {
            const sessionData = sessionDoc.data();
            if (sessionData.userId === auth.currentUser.uid && sessionData.status !== 'completed') {
              setCameraState({ isActive: true });
              toast.success(`Resuming interview - Question ${interviewState.currentQuestion + 1}`);
              setLoading(false);
              return;
            }
          }
        } catch (error) {
          console.log('Session verification failed, creating new session');
          resetInterview();
        }
      }

      let currentAppData = { ...applicationData };
      if (templateId) {
        try {
          const templateDoc = await getDoc(doc(db, 'interviewTemplates', templateId));
          if (templateDoc.exists()) {
            const templateData = templateDoc.data();

            if (!canAttemptTemplate(templateId)) {
              toast.error('Maximum attempts (3) reached for this template');
              navigate('/');
              return;
            }

            currentAppData = {
              jobRole: templateData.jobRole,
              jobDescription: templateData.jobDescription,
              companyName: templateData.companyName || '',
              resumeContent: templateData.resumeFileName ? `Resume file: ${templateData.resumeFileName}` : null,
              templateId: templateId,
              interviewMode: applicationData.interviewMode || 'standard',
              questionCount: applicationData.questionCount || 8
            };

            setApplicationData(currentAppData);
            setInterviewState({ currentTemplate: templateData });
          } else {
            toast.error('Interview template not found');
            navigate('/');
            return;
          }
        } catch (templateError) {
          console.error('Error loading template:', templateError);
          toast.error('Failed to load interview template');
          navigate('/');
          return;
        }
      }

      if (!currentAppData.jobRole || !currentAppData.jobDescription) {
        toast.error('Missing application data');
        navigate('/');
        return;
      }

      const sessionId = `session_${Date.now()}_${auth.currentUser.uid}`;

      toast.loading('Generating interview questions and audio...');
      const result = await processApplication({
        jobRole: currentAppData.jobRole,
        jobDescription: currentAppData.jobDescription,
        resumeContent: currentAppData.resumeContent || null,
        companyName: currentAppData.companyName || null,
        questionCount: currentAppData.questionCount || 8
      });

      const questionsWithTTS = [];
      for (const question of result.data.questions) {
        try {
          const ttsResult = await textToSpeech({
            text: question.question,
            questionId: question.id,
            sessionId: sessionId
          });
          questionsWithTTS.push({
            ...question,
            audioUrl: ttsResult.data.audioUrl
          });
        } catch (ttsError) {
          console.error('TTS generation failed for question:', question.id);
          questionsWithTTS.push(question);
        }
      }

      toast.dismiss();

      const sessionResult = await createInterviewSession({
        applicationId: result.data.applicationId,
        sessionId: sessionId,
        jobRole: currentAppData.jobRole,
        questions: questionsWithTTS,
        criteria: result.data.criteria,
        templateId: templateId || null
      });

      setInterviewState({
        sessionId: sessionResult.data.sessionId,
        questions: questionsWithTTS,
        questionsWithTTS: questionsWithTTS,
        criteria: result.data.criteria,
        currentQuestion: 0,
        answers: [],
        applicationId: result.data.applicationId,
        templateId: templateId || null,
        startedAt: new Date().toISOString(),
        completed: false,
        finalReport: null,
        completedAt: null,
        proctorWarning: null,
        proctoringEvents: [],
        questionsGenerated: true,
        resumeFromRefresh: false,
        emotionHistory: []
      });

      setCameraState({ isActive: true });

      toast.success('Interview initialized successfully!');
    } catch (error) {
      console.error('Error initializing interview:', error);
      setError('Failed to initialize interview. Please try again.');
      toast.error('Failed to start interview');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmitted = async (answerData) => {
    setCurrentChatAnswer('');
    
    const isLastQuestion = interviewState.currentQuestion >= interviewState.questions.length - 1;
    if (isLastQuestion) {
      await completeInterview();
    }
  };

  const completeInterview = async () => {
    try {
      setInterviewState({
        completed: true,
        finalReport: null,
        emotionHistory: emotionHistory
      });

      stopCamera();

      toast.loading('Generating your interview report...');
      
      const report = await generateReport({
        sessionId: interviewState.sessionId,
        applicationId: interviewState.applicationId,
        emotionHistory: emotionHistory
      });

      setInterviewState({
        finalReport: report.data,
        completedAt: new Date().toISOString(),
        emotionHistory: emotionHistory
      });

      // ✅ NEW: Refresh template data immediately
      if (templateId) {
        console.log('Refreshing template data after report generation...');
        try {
          const freshData = await refreshTemplateData(templateId);
          if (freshData) {
            console.log('✅ Template refreshed in InterviewSession - Attempt count:', freshData.attemptCount);
          }
        } catch (refreshError) {
          console.error('⚠️ Failed to refresh template data:', refreshError);
          // Don't fail the interview completion if template refresh fails
        }
      }

      toast.dismiss();
      toast.success('Interview completed! Redirecting to results...');
      setTimeout(() => {
        navigate(`/results/${interviewState.sessionId}`);
      }, 2000);

    } catch (error) {
      toast.dismiss();
      toast.error('Failed to generate report. Please try again.');
      setInterviewState({
        completed: false
      });
      setCameraState({ isActive: true });
    }
  };

  const exitInterview = () => {
    if (window.confirm('Are you sure you want to exit the interview? Your progress will be saved and you can resume later.')) {
      stopCamera();
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Preparing Your Interview</h2>
          <p className="text-gray-600">AI is generating personalized questions for {applicationData.jobRole || 'your role'}...</p>
          {interviewState.resumeFromRefresh && (
            <p className="text-blue-600 mt-2">Resuming previous session...</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Interview Setup Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (interviewState.completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Interview Completed!</h2>
          <p className="text-gray-600 mb-6">
            Congratulations! Your AI interview analysis is ready.
          </p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Redirecting to results...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = interviewState.questions[interviewState.currentQuestion];
  if (!currentQuestion) {
    if (!interviewState.completed) {
      setTimeout(() => completeInterview(), 100);
    }
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Processing Interview...</h2>
          <p className="text-gray-600 mb-6">Finalizing your interview results.</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  const progress = ((interviewState.currentQuestion + 1) / interviewState.questions.length) * 100;

  // Determine layout based on question content
  const requiresWrittenAnswer = currentQuestion.requiresWrittenAnswer || 
    (currentQuestion.question && (
      currentQuestion.question.toLowerCase().includes('code') ||
      currentQuestion.question.toLowerCase().includes('algorithm') ||
      currentQuestion.question.toLowerCase().includes('write') ||
      currentQuestion.question.toLowerCase().includes('implement') ||
      currentQuestion.question.toLowerCase().includes('function') ||
      currentQuestion.question.toLowerCase().includes('sql') ||
      currentQuestion.question.toLowerCase().includes('query') ||
      currentQuestion.question.toLowerCase().includes('design')
    ));

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-full mx-auto px-6">
          <div className="flex justify-between items-center py-4">
            <button
              onClick={exitInterview}
              className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Exit Interview</span>
            </button>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <User className="h-4 w-4" />
                <span>{applicationData.jobRole}</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <Clock className="h-4 w-4" />
                <span>Question {interviewState.currentQuestion + 1} of {interviewState.questions.length}</span>
              </div>
              {interviewState.resumeFromRefresh && (
                <div className="px-2 py-1 bg-blue-900 text-blue-200 text-xs rounded">
                  Resumed
                </div>
              )}
              {warning && (
                <div className="px-3 py-1 bg-yellow-900 text-yellow-200 text-xs rounded-lg">
                  ⚠️ {warning}
                </div>
              )}
            </div>
          </div>
          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-1.5 mb-4">
            <div 
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>
      
      {/* Main Interview Content - Single Unified Component */}
      <InterviewLayout
        layout={requiresWrittenAnswer ? 'written' : 'standard'}
        question={currentQuestion}
        questionNumber={interviewState.currentQuestion + 1}
        totalQuestions={interviewState.questions.length}
        videoRef={videoRef}
        onAnswerSubmitted={handleAnswerSubmitted}
        currentChatAnswer={currentChatAnswer}
        setCurrentChatAnswer={setCurrentChatAnswer}
      />
    </div>
  );
}
