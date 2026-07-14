// src/App.jsx - Complete with Pricing Route
import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import InterviewForm from "./pages/InterviewForm";
import TemplateDetails from "./pages/TemplateDetails";
import InterviewSession from "./components/interview/InterviewSession";
import Results from "./pages/Results";
import Landing from "./pages/Landing";
import Pricing from "./pages/Pricing";
import useStore from "./store/useStore";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const { stopCamera, setSubscription } = useStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Load subscription data if user is authenticated
      if (currentUser) {
        await loadUserSubscription(currentUser.uid);
      } else {
        stopCamera();
      }
      
      setLoading(false);
    });

    // Cleanup camera on app unmount
    return () => {
      unsubscribe();
      stopCamera();
    };
  }, [stopCamera, setSubscription]);

  // 🆕 Load user subscription from Firestore
  const loadUserSubscription = async (userId) => {
    try {
      const subscriptionDoc = await getDoc(doc(db, 'subscriptions', userId));
      
      if (subscriptionDoc.exists()) {
        const subData = subscriptionDoc.data();
        
        // Check if subscription is still active
        const now = new Date();
        const endDate = subData.endDate?.toDate ? subData.endDate.toDate() : new Date(subData.endDate);
        
        if (endDate > now && subData.status === 'active') {
          setSubscription(subData);
        } else {
          // Subscription expired - reset to free
          setSubscription({
            plan: 'free',
            status: 'expired',
            features: {
              templateLimit: 1,
              attemptLimit: 1,
              modes: ['short'],
              emotionAnalysis: false,
              advancedReports: false,
              prioritySupport: false
            }
          });
        }
      } else {
        // No subscription found - set to free plan
        setSubscription({
          plan: 'free',
          status: 'active',
          features: {
            templateLimit: 1,
            attemptLimit: 1,
            modes: ['short'],
            emotionAnalysis: false,
            advancedReports: false,
            prioritySupport: false
          }
        });
      }
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-700">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes - Always Accessible */}
        <Route path="/landing" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/signin" element={!user ? <SignIn /> : <Navigate to="/" replace />} />
        
        {/* Conditional Routing Based on Authentication */}
        {user ? (
          <>
            {/* Protected Routes - Only for Authenticated Users */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/create-interview" element={<InterviewForm />} />
            <Route path="/template/:templateId" element={<TemplateDetails />} />
            <Route path="/interview/:templateId" element={<InterviewSession />} />
            <Route path="/results/:sessionId" element={<Results />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : (
          <>
            {/* Unauthenticated Users - Show Landing */}
            <Route path="/" element={<Landing />} />
            <Route path="*" element={<Navigate to="/landing" replace />} />
          </>
        )}
      </Routes>
    </Router>
  );
}
