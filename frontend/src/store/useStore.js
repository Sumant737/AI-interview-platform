// src/store/useStore.js - Complete with Subscription Management + Template Refresh
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set, get) => ({
      // User & Application Data
      currentUser: null,
      applicationData: {
        jobRole: '',
        jobDescription: '',
        resumeFile: null,
        companyName: '',
        applicationId: null,
        templateId: null,
        resumeContent: null,
        interviewMode: 'standard',
        questionCount: 8
      },

      // Interview State - Enhanced with session persistence
      interviewState: {
        sessionId: null,
        templateId: null,
        currentQuestion: 0,
        questions: [],
        answers: [],
        isRecording: false,
        isPlaying: false,
        transcription: '',
        liveTranscript: '',
        score: null,
        feedback: [],
        completed: false,
        finalReport: null,
        completedAt: null,
        startedAt: null,
        proctorWarning: null,
        proctoringEvents: [],
        resumeFromRefresh: false,
        questionsGenerated: false,
        questionsWithTTS: [],
        currentTemplate: null
      },

      // Audio State
      audioState: {
        mediaRecorder: null,
        audioChunks: [],
        speechSynthesis: null,
        recognition: null
      },

      // Template Management State
      templateState: {
        userTemplates: [],
        currentTemplateAttempts: [],
        templateLimit: 5,
        attemptLimit: 3
      },

      // 🆕 NEW: Subscription State
      subscription: {
        plan: 'free', // free, student, pro, premium
        status: 'active', // active, cancelled, expired
        startDate: null,
        endDate: null,
        paymentId: null,
        orderId: null,
        features: {
          templateLimit: 1,
          attemptLimit: 1,
          modes: ['short'],
          emotionAnalysis: false,
          advancedReports: false,
          prioritySupport: false
        }
      },

      // Camera Management
      cameraState: {
        stream: null,
        isActive: false
      },

      // Actions
      setCurrentUser: (user) => set({ currentUser: user }),

      setApplicationData: (data) => set({ 
        applicationData: { ...get().applicationData, ...data }
      }),

      setInterviewState: (updates) => set({
        interviewState: { ...get().interviewState, ...updates }
      }),

      setAudioState: (updates) => set({
        audioState: { ...get().audioState, ...updates }
      }),

      setTemplateState: (updates) => set({
        templateState: { ...get().templateState, ...updates }
      }),

      // 🆕 NEW: Subscription Actions
      setSubscription: (subscriptionData) => {
        const currentSub = get().subscription;
        const updatedSub = { ...currentSub, ...subscriptionData };
        
        // Update template limits based on plan
        const templateState = get().templateState;
        set({
          subscription: updatedSub,
          templateState: {
            ...templateState,
            templateLimit: updatedSub.features.templateLimit,
            attemptLimit: updatedSub.features.attemptLimit
          }
        });
      },

      // 🆕 NEW: Check if user can access feature
      canAccessFeature: (feature) => {
        const { subscription } = get();
        return subscription.features[feature] || false;
      },

      // 🆕 NEW: Check if user can access mode
      canAccessMode: (mode) => {
        const { subscription } = get();
        return subscription.features.modes.includes(mode);
      },

      // 🆕 NEW: Get plan limits
      getPlanLimits: () => {
        const { subscription } = get();
        return {
          templateLimit: subscription.features.templateLimit,
          attemptLimit: subscription.features.attemptLimit,
          modes: subscription.features.modes
        };
      },

      // ✅ NEW: Refresh template data from Firestore
      refreshTemplateData: async (templateId) => {
        try {
          // Dynamic import to avoid circular dependencies
          const { getDoc, doc } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          
          const templateDoc = await getDoc(doc(db, 'interviewTemplates', templateId));
          
          if (templateDoc.exists()) {
            const freshData = {
              id: templateDoc.id,
              ...templateDoc.data()
            };
            
            console.log('✅ Template data refreshed from Firestore:', {
              templateId,
              attemptCount: freshData.attemptCount,
              lastScore: freshData.lastScore,
              lastGrade: freshData.lastGrade
            });
            
            // Update the template in userTemplates array
            const currentTemplates = get().templateState.userTemplates;
            const updatedTemplates = currentTemplates.map(t => 
              t.id === templateId ? { ...t, ...freshData } : t
            );
            
            // If template not in array, add it
            if (!currentTemplates.find(t => t.id === templateId)) {
              updatedTemplates.push(freshData);
            }
            
            // Update currentTemplate if it matches
            const currentTemplate = get().interviewState.currentTemplate;
            const updatedCurrentTemplate = currentTemplate?.id === templateId 
              ? { ...currentTemplate, ...freshData }
              : currentTemplate;
            
            set({
              templateState: {
                ...get().templateState,
                userTemplates: updatedTemplates
              },
              interviewState: {
                ...get().interviewState,
                currentTemplate: updatedCurrentTemplate
              }
            });
            
            return freshData;
          } else {
            console.warn('⚠️ Template not found:', templateId);
            return null;
          }
        } catch (error) {
          console.error('❌ Error refreshing template data:', error);
          return null;
        }
      },

      // ✅ NEW: Refresh all user templates
      refreshAllTemplates: async (userId) => {
        try {
          const { getDocs, collection, query, where, orderBy } = await import('firebase/firestore');
          const { db } = await import('../firebase');
          
          const templatesQuery = query(
            collection(db, 'interviewTemplates'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
          );
          
          const snapshot = await getDocs(templatesQuery);
          const templates = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          
          console.log('✅ All templates refreshed:', templates.length);
          
          set({
            templateState: {
              ...get().templateState,
              userTemplates: templates
            }
          });
          
          return templates;
        } catch (error) {
          console.error('❌ Error refreshing all templates:', error);
          return [];
        }
      },

      // Session Management Methods
      hasActiveSession: () => {
        const state = get().interviewState;
        return !!(state.sessionId && state.questions.length > 0 && !state.completed);
      },

      resumeSession: (sessionData) => set({
        interviewState: { 
          ...get().interviewState, 
          ...sessionData,
          resumeFromRefresh: true 
        }
      }),

      canCreateTemplate: () => {
        const templates = get().templateState.userTemplates;
        const limit = get().templateState.templateLimit;
        return templates.length < limit;
      },

      canAttemptTemplate: (templateId) => {
        const template = get().templateState.userTemplates.find(t => t.id === templateId);
        const limit = get().templateState.attemptLimit;
        
        if (!template) {
          console.warn('⚠️ Template not found in store:', templateId);
          return false;
        }
        
        const canAttempt = (template.attemptCount || 0) < limit;
        console.log('Check template attempt:', {
          templateId,
          currentAttempts: template.attemptCount || 0,
          limit,
          canAttempt
        });
        
        return canAttempt;
      },

      // Reset functions
      resetInterview: () => set({
        interviewState: {
          sessionId: null,
          templateId: null,
          currentQuestion: 0,
          questions: [],
          answers: [],
          isRecording: false,
          isPlaying: false,
          transcription: '',
          liveTranscript: '',
          score: null,
          feedback: [],
          completed: false,
          finalReport: null,
          completedAt: null,
          startedAt: null,
          proctorWarning: null,
          proctoringEvents: [],
          resumeFromRefresh: false,
          questionsGenerated: false,
          questionsWithTTS: [],
          currentTemplate: null
        }
      }),

      resetApplication: () => set({
        applicationData: {
          jobRole: '',
          jobDescription: '',
          resumeFile: null,
          companyName: '',
          applicationId: null,
          templateId: null,
          resumeContent: null,
          interviewMode: 'standard',
          questionCount: 8
        }
      }),

      setCameraState: (updates) => set({
        cameraState: { ...get().cameraState, ...updates }
      }),

      stopCamera: () => {
        const stream = get().cameraState.stream;
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        set({ cameraState: { stream: null, isActive: false } });
      }
    }),
    {
      name: 'ai-interview-storage',
      partialize: (state) => ({ 
        applicationData: state.applicationData,
        currentUser: state.currentUser,
        interviewState: state.interviewState,
        templateState: state.templateState,
        subscription: state.subscription // 🆕 Persist subscription
      })
    }
  )
);

export default useStore;
