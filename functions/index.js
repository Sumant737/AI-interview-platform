// functions/index.js - UPDATED WITH GEMINI 2.5 FLASH-LITE & RAZORPAY
const { onCall, onRequest} = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { SpeechClient } = require('@google-cloud/speech');
const crypto = require('crypto');
const Razorpay = require('razorpay');

// ✅ Load environment variables FIRST
require('dotenv').config();

// Set global options for Gen2 functions
setGlobalOptions({
  region: 'asia-southeast1',
  maxInstances: 10,
  timeoutSeconds: 540,
  memory: '1GiB'
});

admin.initializeApp();

// ✅ FIXED: Initialize Gemini 2.5 Flash-Lite with proper error handling
let genAI, model;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ Gemini API key not configured. Add GEMINI_API_KEY to .env file');
    throw new Error('Gemini API key not configured');
  }
  
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
      maxOutputTokens: 8192
    }
  });
  console.log('✅ Gemini 2.5 Flash-Lite initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Gemini:', error);
}

// Initialize Google Cloud clients
const ttsClient = new TextToSpeechClient();
const speechClient = new SpeechClient();

// ✅ FIXED: Initialize Razorpay with proper error handling
let razorpay;
try {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  
  console.log('🔑 Checking Razorpay credentials...');
  console.log('  - Key ID:', keyId ? `${keyId.substring(0, 10)}... (${keyId.length} chars)` : '❌ MISSING');
  console.log('  - Secret:', keySecret ? `${keySecret.substring(0, 5)}... (${keySecret.length} chars)` : '❌ MISSING');
  
  if (!keyId || !keySecret) {
    console.error('❌ Razorpay credentials not configured');
    console.error('   Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env file');
    throw new Error('Razorpay credentials missing');
  }
  
  razorpay = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
  
  console.log('✅ Razorpay initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Razorpay:', error.message);
  razorpay = null; // Set to null so we can check it later
}

// Enhanced JSON cleaning function for Gemini 2.5
function cleanJsonResponse(responseText) {
  console.log('Raw Gemini 2.5 response:', responseText.substring(0, 500) + '...');
  
  try {
    return JSON.parse(responseText);
  } catch (e) {
    console.log('Direct JSON parse failed, attempting cleanup...');
  }
  
  let cleaned = responseText.replace(/``````\s*/g, '');
  
  const startIndex = cleaned.indexOf('{');
  const lastIndex = cleaned.lastIndexOf('}');
  
  if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
    cleaned = cleaned.substring(startIndex, lastIndex + 1);
  }
  
  console.log('Cleaned JSON:', cleaned.substring(0, 300) + '...');
  return cleaned;
}

exports.createPaymentLink = onCall(async (request) => {
  const { planId, billingCycle } = request.data;
  const userId = request.auth?.uid;

  if (!userId) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in');
  }

  try {
    // Get user details
    const userRecord = await admin.auth().getUser(userId);
    const userName = userRecord.displayName || 'User';
    const userEmail = userRecord.email || '';

    const planPricing = {
      student: { monthly: 199, yearly: 1999 },
      pro: { monthly: 499, yearly: 4999 },
      premium: { monthly: 999, yearly: 9999 }
    };

    const amount = planPricing[planId]?.[billingCycle];

    const paymentPageUrls = {
      student_monthly: 'https://rzp.io/rzp/NjUXceH',
      student_yearly: 'https://rzp.io/rzp/k2lAmS0K',
      pro_monthly: 'https://rzp.io/rzp/55vDbLb',
      pro_yearly: 'https://rzp.io/rzp/TM2HWA9',
      premium_monthly: 'https://rzp.io/rzp/KrmXRcr',
      premium_yearly: 'https://rzp.io/rzp/UjqxQea'
    };

    const baseUrl = paymentPageUrls[`${planId}_${billingCycle}`];

    // ✅ BUILD URL WITH PRE-FILLED DATA AND NOTES
    const params = new URLSearchParams({
      'prefill[name]': userName,
      'prefill[email]': userEmail,
      'notes[userId]': userId,
      'notes[planId]': planId,
      'notes[billingCycle]': billingCycle
    });

    const paymentUrl = `${baseUrl}?${params.toString()}`;

    console.log('✅ Payment link created:', paymentUrl);

    return {
      success: true,
      paymentUrl,
      amount
    };

  } catch (error) {
    console.error('❌ Payment link error:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});

exports.razorpayWebhook = onRequest({ cors: false }, async (req, res) => {
  console.log('🔔 Webhook received');

  // ✅ 1. VERIFY WEBHOOK SIGNATURE
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const webhookSignature = req.headers['x-razorpay-signature'];
  
  if (!webhookSecret) {
    console.error('❌ Webhook secret not configured');
    return res.status(500).send('Webhook secret missing');
  }

  const webhookBody = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(webhookBody)
    .digest('hex');

  if (webhookSignature !== expectedSignature) {
    console.error('❌ Invalid webhook signature');
    return res.status(400).send('Invalid signature');
  }

  console.log('✅ Webhook signature verified');

  // ✅ 2. EXTRACT EVENT DATA
  const event = req.body.event;
  const payload = req.body.payload;

  try {
    // ✅ 3. HANDLE SUCCESSFUL PAYMENT
    if (event === 'payment.captured') {
      console.log('💰 Payment captured event');
      
      const paymentEntity = payload.payment.entity;
      
      // ✅ EXTRACT FROM NOTES (works with both custom fields AND URL params)
      const notes = paymentEntity.notes || {};
      const userId = notes.userId;
      const planId = notes.planId;
      const billingCycle = notes.billingCycle;

      console.log('📋 Payment details:', { 
        userId, 
        planId, 
        billingCycle,
        amount: paymentEntity.amount / 100 
      });

      // ✅ 4. VALIDATE REQUIRED DATA
      if (!userId || !planId || !billingCycle) {
        console.error('❌ Missing required fields:', { userId, planId, billingCycle });
        return res.status(400).send('Missing required payment data');
      }

      // ✅ 5. CALCULATE SUBSCRIPTION DATES
      const startDate = new Date();
      const endDate = new Date(startDate);
      
      if (billingCycle === 'monthly') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else if (billingCycle === 'yearly') {
        endDate.setFullYear(endDate.getFullYear() + 1);
      } else {
        console.error('❌ Invalid billing cycle:', billingCycle);
        return res.status(400).send('Invalid billing cycle');
      }

      // ✅ 6. CREATE/UPDATE SUBSCRIPTION IN FIRESTORE
      const subscriptionData = {
        userId,
        plan: planId,
        status: 'active',
        billingCycle,
        amount: paymentEntity.amount / 100, // Convert paise to rupees
        startDate: admin.firestore.Timestamp.fromDate(startDate),
        endDate: admin.firestore.Timestamp.fromDate(endDate),
        paymentId: paymentEntity.id,
        orderId: paymentEntity.order_id || 'N/A',
        method: paymentEntity.method,
        email: paymentEntity.email,
        contact: paymentEntity.contact,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('subscriptions').doc(userId).set(subscriptionData);

      // ✅ 7. SAVE PAYMENT RECORD
      await db.collection('payments').add({
        ...subscriptionData,
        webhookEvent: event,
        razorpayPaymentId: paymentEntity.id,
        rawAmount: paymentEntity.amount
      });

      console.log(`✅ Subscription activated for user: ${userId}`);
      console.log(`Plan: ${planId} | Cycle: ${billingCycle} | Expires: ${endDate.toISOString()}`);
    }

    // ✅ 8. HANDLE FAILED PAYMENT
    else if (event === 'payment.failed') {
      console.log('❌ Payment failed event');
      const paymentEntity = payload.payment.entity;
      const notes = paymentEntity.notes || {};
      
      await db.collection('failedPayments').add({
        userId: notes.userId,
        planId: notes.planId,
        billingCycle: notes.billingCycle,
        paymentId: paymentEntity.id,
        amount: paymentEntity.amount / 100,
        email: paymentEntity.email,
        errorCode: paymentEntity.error_code,
        errorDescription: paymentEntity.error_description,
        errorReason: paymentEntity.error_reason,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`❌ Payment failed for user: ${notes.userId}`);
    }

    res.status(200).send('Webhook processed successfully');
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send('Webhook processing failed');
  }
});



// 🔥 UPDATED: Process Application with Gemini 2.5 Pro
// 🔥 UPDATED: Process Application with Gemini 2.5 Pro + DYNAMIC QUESTION COUNT
exports.processApplication = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    if (!model) {
      throw new Error('Gemini 2.5 Pro model not configured properly');
    }

    // 🔥 NEW: Accept questionCount parameter, default to 5
    const { jobRole, jobDescription, resumeContent, companyName, questionCount = 5 } = request.data;
    const userId = request.auth.uid;

    // 🔥 NEW: Validate and clamp questionCount to 3-15 range
    const validatedQuestionCount = Math.min(Math.max(questionCount, 3), 15);

    console.log('Processing application with Gemini 2.5 Pro for user:', userId, 'Job Role:', jobRole, 'Questions:', validatedQuestionCount);

    // Create application document with userId
    const applicationRef = admin.firestore().collection('applications').doc();
    const applicationId = applicationRef.id;

    // 🔥 UPDATED: Enhanced prompt with DYNAMIC question count
    let contextPrompt = `
You are an expert AI interviewer. Create a comprehensive interview for this position:

Job Role: ${jobRole}
Job Description: ${jobDescription}
${companyName ? `Company: ${companyName}` : ''}
${resumeContent ? `Resume Content: ${resumeContent}` : 'No resume provided'}

Generate exactly ${validatedQuestionCount} interview questions that are:
1. Role-specific and highly relevant to the job description
2. Progressive in difficulty (foundation → intermediate → advanced)
3. Mix of technical, behavioral, and situational questions
4. Company-specific if company name provided
5. Industry best practices and current trends aware

For questions that require written answers (coding, algorithms, SQL queries, system design, etc.), 
set requiresWrittenAnswer to true and use type as coding or technical.

IMPORTANT: Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):

{
  "criteria": [
    "Technical expertise and knowledge",
    "Problem-solving and analytical thinking", 
    "Communication and teamwork skills",
    "Leadership and decision-making ability",
    "Cultural fit and motivation"
  ],
  "questions": [
    ${Array.from({ length: validatedQuestionCount }, (_, i) => `
    { 
      "id": ${i + 1}, 
      "question": "Question ${i + 1} text...", 
      "type": "behavioral|technical|situational|coding", 
      "requiresWrittenAnswer": false,
      "expectedPoints": ["point 1", "point 2"], 
      "maxScore": 20 
    }${i < validatedQuestionCount - 1 ? ',' : ''}
    `).join('')}
  ]
}

Generate EXACTLY ${validatedQuestionCount} questions following the pattern above.
Ensure at least one coding/technical question with requiresWrittenAnswer: true if the role is technical.`;

    console.log('Calling Gemini 2.5 Pro to generate', validatedQuestionCount, 'questions...');

    // 🔥 UPDATED: Generate questions using Gemini 2.5 with enhanced error handling
    let questionsData;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const result = await model.generateContent(contextPrompt);
        const response = await result.response;
        const responseText = response.text();
        
        console.log(`Attempt ${attempts + 1} - Gemini 2.5 response received`);
        
        // 🔥 UPDATED: Handle JSON response from Gemini 2.5
        if (typeof responseText === 'string') {
          const cleanedResponse = cleanJsonResponse(responseText);
          questionsData = typeof cleanedResponse === 'string' ? JSON.parse(cleanedResponse) : cleanedResponse;
        } else {
          questionsData = responseText; // Already parsed
        }
        
        // 🔥 NEW: Validate the response has correct number of questions
        if (!questionsData.criteria || !questionsData.questions) {
          throw new Error('Invalid response structure from Gemini 2.5');
        }

        // 🔥 NEW: Ensure we have the exact number of questions requested
        if (questionsData.questions.length !== validatedQuestionCount) {
          console.warn(`Expected ${validatedQuestionCount} questions, got ${questionsData.questions.length}. Adjusting...`);
          
          if (questionsData.questions.length > validatedQuestionCount) {
            // Trim excess questions
            questionsData.questions = questionsData.questions.slice(0, validatedQuestionCount);
          } else if (questionsData.questions.length < validatedQuestionCount) {
            // Log warning but use what we got
            console.warn(`Only ${questionsData.questions.length} questions generated, using available questions`);
          }
        }
        
        console.log('Questions parsed successfully with Gemini 2.5 Pro');
        break; // Success, exit retry loop
        
      } catch (parseError) {
        attempts++;
        console.error(`Parse attempt ${attempts} failed:`, parseError.message);
        
        if (attempts >= maxAttempts) {
          console.error('Failed to parse Gemini 2.5 response after all attempts');
          throw new Error('Failed to generate questions with Gemini 2.5 - JSON parsing failed');
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('Questions generated successfully with Gemini 2.5, saving to Firestore...');

    // Save application data with userId
    await applicationRef.set({
      userId,
      jobRole,
      jobDescription,
      companyName: companyName || null,
      resumeContent: resumeContent || null,
      criteria: questionsData.criteria,
      questions: questionsData.questions,
      questionCount: questionsData.questions.length, // 🔥 NEW: Store actual question count
      aiModel: 'gemini-2.5-pro',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'ready'
    });

    console.log('Application saved with ID:', applicationId, 'with', questionsData.questions.length, 'questions');

    return {
      applicationId,
      questions: questionsData.questions,
      criteria: questionsData.criteria,
      aiModel: 'gemini-2.5-pro'
    };

  } catch (error) {
    console.error('Error processing application:', error);
    throw new Error(error.message || 'Failed to process application');
  }
});


// 🔥 NEW: Async evaluation function that runs in background
exports.evaluateAnswerAsync = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    const { sessionId, questionId } = request.data;
    const userId = request.auth.uid;

    console.log('Starting async evaluation for session:', sessionId, 'question:', questionId);

    // Get the answer from Firestore
    const answerDoc = await admin.firestore()
      .collection('sessions')
      .doc(sessionId)
      .collection('answers')
      .doc(questionId.toString())
      .get();

    if (!answerDoc.exists) {
      throw new Error('Answer not found');
    }

    const answerData = answerDoc.data();

    // Verify user owns this answer
    if (answerData.userId !== userId) {
      throw new Error('Unauthorized access to answer');
    }

    // Check if already evaluated
    if (answerData.evaluation && answerData.evaluationStatus === 'completed') {
      console.log('Answer already evaluated, skipping');
      return { success: true, alreadyEvaluated: true };
    }

    // Get session data for context
    const sessionDoc = await admin.firestore()
      .collection('sessions')
      .doc(sessionId)
      .get();

    if (!sessionDoc.exists) {
      throw new Error('Session not found');
    }

    const sessionData = sessionDoc.data();

    // Mark as evaluating
    await admin.firestore()
      .collection('sessions')
      .doc(sessionId)
      .collection('answers')
      .doc(questionId.toString())
      .update({
        evaluationStatus: 'evaluating',
        evaluationStartedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    // Find the question details
    const question = sessionData.questions.find(q => q.id === parseInt(questionId));
    
    if (!question) {
      throw new Error('Question not found in session');
    }

    if (!model) {
      throw new Error('Gemini 2.5 Pro model not configured properly');
    }

    // Enhanced evaluation prompt
    const evaluationPrompt = `
You are an expert interviewer using advanced AI analysis. Evaluate this interview answer comprehensively.

INTERVIEW DETAILS:
Question: ${question.question}
Job Role: ${sessionData.jobRole}
Question Type: ${question.type || 'general'}
Expected Points: ${question.expectedPoints?.join(', ') || 'N/A'}
Maximum Score: ${question.maxScore || 20}

CANDIDATE RESPONSES:
Verbal Answer: ${answerData.verbalAnswer || 'No verbal answer provided'}
Written Answer: ${answerData.writtenAnswer || 'No written answer provided'}

SPEECH ANALYSIS:
${answerData.speechAnalysisData ? `
- Speech Confidence: ${answerData.speechAnalysisData.confidence || 'N/A'}
- Words per Minute: ${answerData.speechAnalysisData.wordsPerMinute || 'N/A'}
- Filler Words: ${answerData.speechAnalysisData.fillerWordCount || 0} (${answerData.speechAnalysisData.fillerPercentage || 0}%)
- Speech Clarity: ${answerData.speechAnalysisData.clarity || 'N/A'}
- Speech Fluency: ${answerData.speechAnalysisData.fluency || 'N/A'}
- Speech Pace: ${answerData.speechAnalysisData.speechPace || 'N/A'}
- Pause Count: ${answerData.speechAnalysisData.pauseCount || 0}
- Long Pauses: ${answerData.speechAnalysisData.longPauses || 0}
` : 'Speech analysis not available'}

INSTRUCTIONS:
Provide comprehensive evaluation including technical content AND communication skills.

IMPORTANT: Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):

{
  "score": 18,
  "feedback": "Detailed feedback on both content and delivery...",
  "strengths": ["technical strength 1", "communication strength 1"],
  "improvements": ["technical improvement 1", "communication improvement 1"],
  "keywordsCovered": ["keyword1", "keyword2"],
  "industryRelevance": "Assessment of industry knowledge",
  "recommendations": ["actionable recommendation 1"],
  "communicationScore": {
    "overall": 8,
    "clarity": 7,
    "pace": 8,
    "confidence": 7,
    "fluency": 8,
    "fillerWordImpact": 6,
    "professionalTone": 8,
    "responseStructure": 7
  },
  "communicationFeedback": {
    "strengths": ["communication strength 1", "communication strength 2"],
    "improvements": ["communication improvement 1", "communication improvement 2"],
    "fillerWordCount": ${answerData.speechAnalysisData?.fillerWordCount || 0},
    "estimatedWPM": ${answerData.speechAnalysisData?.wordsPerMinute || 0},
    "pauseAnalysis": "Analysis of pauses and timing...",
    "overallDelivery": "Assessment of overall communication effectiveness"
  }
}`;

    console.log('Sending evaluation prompt to Gemini 2.5 Pro...');

    let evaluation;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const result = await model.generateContent(evaluationPrompt);
        const response = await result.response;
        const responseText = response.text();
        
        console.log(`Evaluation attempt ${attempts + 1} - Gemini 2.5 response received`);
        
        if (typeof responseText === 'string') {
          const cleanedResponse = cleanJsonResponse(responseText);
          evaluation = typeof cleanedResponse === 'string' ? JSON.parse(cleanedResponse) : cleanedResponse;
        } else {
          evaluation = responseText;
        }
        
        if (typeof evaluation.score !== 'number' || !evaluation.feedback || !evaluation.communicationScore) {
          throw new Error('Invalid evaluation structure from Gemini 2.5');
        }
        
        console.log('Evaluation parsed successfully, score:', evaluation.score);
        break;
        
      } catch (parseError) {
        attempts++;
        console.error(`Evaluation parse attempt ${attempts} failed:`, parseError.message);
        
        if (attempts >= maxAttempts) {
          throw new Error('Failed to evaluate answer with Gemini 2.5 - JSON parsing failed');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Save evaluation to Firestore
    await admin.firestore()
      .collection('sessions')
      .doc(sessionId)
      .collection('answers')
      .doc(questionId.toString())
      .update({
        evaluation: {
          ...evaluation,
          aiModel: 'gemini-2.5-pro',
          analysisTimestamp: new Date().toISOString()
        },
        evaluationStatus: 'completed',
        evaluationCompletedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    console.log('Async evaluation completed and saved for question:', questionId);
    return { success: true, score: evaluation.score };

  } catch (error) {
    console.error('Error in async evaluation:', error);
    
    // Mark evaluation as failed
    try {
      await admin.firestore()
        .collection('sessions')
        .doc(request.data.sessionId)
        .collection('answers')
        .doc(request.data.questionId.toString())
        .update({
          evaluationStatus: 'failed',
          evaluationError: error.message,
          evaluationFailedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (updateError) {
      console.error('Failed to mark evaluation as failed:', updateError);
    }
    
    throw new Error(error.message || 'Failed to evaluate answer asynchronously');
  }
});

// ========== FIXED: EMOTION ANALYSIS HELPER WITH BETTER STABILITY CALCULATION ==========
function analyzeEmotions(emotionHistory, questions) {
  if (!emotionHistory || emotionHistory.length === 0) {
    return null;
  }

  // Calculate emotion distribution
  const emotionCounts = {};
  let totalEmotions = 0;

  emotionHistory.forEach(entry => {
    const emotion = entry.emotion || 'neutral';
    emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    totalEmotions++;
  });

  // Convert to percentages
  const emotionDistribution = {};
  Object.keys(emotionCounts).forEach(emotion => {
    emotionDistribution[emotion] = Math.round((emotionCounts[emotion] / totalEmotions) * 100);
  });

  // Find dominant emotion
  const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) => 
    emotionCounts[a] > emotionCounts[b] ? a : b
  );

  // 🔧 FIXED: Calculate emotional stability using entropy-based approach
  // Lower entropy = more consistent = higher stability
  const totalCount = Object.values(emotionCounts).reduce((a, b) => a + b, 0);
  let entropy = 0;

  Object.values(emotionCounts).forEach(count => {
    const probability = count / totalCount;
    if (probability > 0) {
      entropy -= probability * Math.log2(probability);
    }
  });

  // Normalize entropy to 0-100 scale
  // Max possible entropy depends on number of distinct emotions
  const numDistinctEmotions = Object.keys(emotionCounts).length;
  const maxEntropy = numDistinctEmotions > 1 ? Math.log2(numDistinctEmotions) : 1;
  
  // Calculate stability: low entropy = high stability
  // Scale it so that:
  // - Single emotion = 100% stable
  // - Evenly distributed emotions = 0% stable
  const normalizedEntropy = (entropy / maxEntropy);
  const emotionalStability = Math.round((1 - normalizedEntropy) * 100);

  // Calculate professional composure (based on ideal distribution)
  const neutralPct = emotionDistribution.neutral || 0;
  const happyPct = emotionDistribution.happy || 0;
  const fearfulPct = emotionDistribution.fearful || 0;
  const sadPct = emotionDistribution.sad || 0;
  const angryPct = emotionDistribution.angry || 0;

  let composureScore = 0;
  
  // Neutral in ideal range (60-70%)
  if (neutralPct >= 50 && neutralPct <= 75) composureScore += 40;
  else if (neutralPct >= 40 && neutralPct < 90) composureScore += 25;
  else composureScore += 10;

  // Happy in ideal range (20-30%)
  if (happyPct >= 20 && happyPct <= 35) composureScore += 40;
  else if (happyPct >= 15 && happyPct <= 40) composureScore += 25;
  else composureScore += 10;

  // Low fearful/sad/angry (<10%)
  if (fearfulPct + sadPct + angryPct < 10) composureScore += 20;
  else if (fearfulPct + sadPct + angryPct < 20) composureScore += 10;

  const professionalComposure = Math.min(100, composureScore);

  // Calculate confidence level
  const positiveEmotions = (happyPct + (emotionDistribution.surprised || 0)) || 0;
  const negativeEmotions = (fearfulPct + sadPct + angryPct) || 0;
  const confidenceLevel = Math.max(0, Math.min(100, 50 + positiveEmotions - negativeEmotions));

  // Determine stress level
  let stressLevel = 'low';
  if (fearfulPct > 20 || (sadPct + angryPct) > 15) stressLevel = 'high';
  else if (fearfulPct > 10 || (sadPct + angryPct) > 10) stressLevel = 'medium';

  // Group emotions by question
  const perQuestionEmotions = [];
  if (questions && questions.length > 0) {
    const emotionsPerQuestion = Math.ceil(emotionHistory.length / questions.length);
    
    for (let i = 0; i < questions.length; i++) {
      const startIdx = i * emotionsPerQuestion;
      const endIdx = Math.min(startIdx + emotionsPerQuestion, emotionHistory.length);
      const questionEmotions = emotionHistory.slice(startIdx, endIdx);
      
      if (questionEmotions.length > 0) {
        const qEmotionCounts = {};
        questionEmotions.forEach(e => {
          qEmotionCounts[e.emotion] = (qEmotionCounts[e.emotion] || 0) + 1;
        });
        
        const qDominant = Object.keys(qEmotionCounts).reduce((a, b) => 
          qEmotionCounts[a] > qEmotionCounts[b] ? a : b
        );
        
        const qConfidence = questionEmotions.reduce((sum, e) => sum + (e.confidence || 0), 0) / questionEmotions.length;
        
        perQuestionEmotions.push({
          questionNumber: i + 1,
          dominantEmotion: qDominant,
          confidence: Math.round(qConfidence * 100),
          emotionChanges: questionEmotions.length,
          startEmotion: questionEmotions[0].emotion,
          endEmotion: questionEmotions[questionEmotions.length - 1].emotion
        });
      }
    }
  }

  return {
    distribution: emotionDistribution,
    dominantEmotion,
    emotionalStability: Math.round(emotionalStability),
    professionalComposure: Math.round(professionalComposure),
    confidenceLevel: Math.round(confidenceLevel),
    stressLevel,
    totalEmotionChanges: emotionHistory.length,
    perQuestionEmotions,
    rawData: {
      neutralPct,
      happyPct,
      fearfulPct,
      sadPct,
      angryPct
    }
  };
}



// 🔥 UPDATED: generateReport with Emotion Analysis
// 🔥 FIXED: generateReport with Proper Transaction Read Order
// 🔥 FIXED: generateReport with Session Counting (NO INCREMENT)
// 🔥 FIXED: generateReport with Session Counting (NO INCREMENT)
exports.generateReport = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    if (!model) {
      throw new Error('Gemini 2.5 Flash-Lite model not configured properly');
    }

    const { sessionId, applicationId, emotionHistory } = request.data;
    const userId = request.auth.uid;
    
    console.log('Generating comprehensive report with Gemini 2.5 Flash-Lite for session:', sessionId);

    // Get session reference
    const sessionRef = admin.firestore().collection('sessions').doc(sessionId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      throw new Error('Session not found');
    }

    const sessionData = sessionDoc.data();
    
    if (sessionData.userId !== userId) {
      throw new Error('Unauthorized access to session');
    }

    // ✅ CRITICAL: If report already generated, return it immediately (idempotency)
    if (sessionData.status === 'completed' && sessionData.finalReport) {
      console.log('Report already exists for session:', sessionId, '- returning cached report');
      return sessionData.finalReport;
    }

    // ✅ Mark session as "generating_report" to prevent concurrent calls
    await sessionRef.update({
      status: 'generating_report',
      reportGenerationStartedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Wait for all evaluations to complete
    const answersSnapshot = await admin.firestore()
      .collection('sessions')
      .doc(sessionId)
      .collection('answers')
      .where('userId', '==', userId)
      .get();
      
    const answers = answersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (answers.length === 0) {
      // Rollback status
      await sessionRef.update({ status: 'active' });
      throw new Error('No answers found for this session');
    }

    // Wait for evaluations
    const maxWaitTime = 120000;
    const checkInterval = 2000;
    let totalWaitTime = 0;
    
    while (totalWaitTime < maxWaitTime) {
      const pendingEvaluations = answers.filter(answer => 
        !answer.evaluationStatus || answer.evaluationStatus === 'evaluating'
      );
      
      if (pendingEvaluations.length === 0) {
        console.log('All evaluations completed');
        break;
      }
      
      console.log(`Waiting for ${pendingEvaluations.length} evaluations to complete...`);
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      totalWaitTime += checkInterval;
      
      const updatedSnapshot = await admin.firestore()
        .collection('sessions')
        .doc(sessionId)
        .collection('answers')
        .where('userId', '==', userId)
        .get();
      
      answers.length = 0;
      updatedSnapshot.docs.forEach(doc => answers.push({ id: doc.id, ...doc.data() }));
    }

    // Analyze emotions
    const emotionAnalysis = analyzeEmotions(emotionHistory, sessionData.questions);
    console.log('Emotion analysis:', emotionAnalysis ? 'completed' : 'skipped (no data)');

    // Calculate scores
    const totalScore = answers.reduce((sum, answer) => sum + (answer.evaluation?.score || 0), 0);
    const maxPossibleScore = answers.length * 20;
    const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

    // Calculate communication scores
    const communicationScores = answers
      .filter(answer => answer.evaluation?.communicationScore)
      .map(answer => answer.evaluation.communicationScore);
    
    let avgCommunicationScore = null;
    if (communicationScores.length > 0) {
      avgCommunicationScore = {
        overall: 0, clarity: 0, pace: 0, confidence: 0, fluency: 0, 
        fillerWordImpact: 0, professionalTone: 0, responseStructure: 0
      };
      
      communicationScores.forEach(scores => {
        Object.keys(avgCommunicationScore).forEach(key => {
          avgCommunicationScore[key] += scores[key] || 0;
        });
      });
      
      Object.keys(avgCommunicationScore).forEach(key => {
        avgCommunicationScore[key] = Math.round((avgCommunicationScore[key] / communicationScores.length) * 10) / 10;
      });
    }

    console.log('Calculated scores - Total:', totalScore, 'Percentage:', percentage);

    // Determine grade
    let grade = 'F';
    if (percentage >= 95) grade = 'A+';
    else if (percentage >= 90) grade = 'A';
    else if (percentage >= 85) grade = 'B+';
    else if (percentage >= 80) grade = 'B';
    else if (percentage >= 75) grade = 'C+';
    else if (percentage >= 70) grade = 'C';
    else if (percentage >= 60) grade = 'D';

    // Enhanced report prompt with emotion analysis
    const reportPrompt = `Generate a comprehensive interview report with detailed question analysis AND emotional intelligence assessment using advanced AI evaluation.

OVERALL PERFORMANCE:
${totalScore}/${maxPossibleScore} (${percentage}%)
JOB ROLE: ${sessionData.jobRole}
GRADE: ${grade}

${emotionAnalysis ? `
EMOTIONAL INTELLIGENCE ANALYSIS:
- Dominant Emotion: ${emotionAnalysis.dominantEmotion} (${emotionAnalysis.distribution[emotionAnalysis.dominantEmotion]}%)
- Emotional Stability: ${emotionAnalysis.emotionalStability}/100
- Professional Composure: ${emotionAnalysis.professionalComposure}/100
- Confidence Level: ${emotionAnalysis.confidenceLevel}/100
- Stress Level: ${emotionAnalysis.stressLevel}

EMOTION DISTRIBUTION:
${Object.entries(emotionAnalysis.distribution)
  .map(([emotion, pct]) => `- ${emotion.charAt(0).toUpperCase() + emotion.slice(1)}: ${pct}%`)
  .join('\n')}

PER-QUESTION EMOTIONAL ANALYSIS:
${emotionAnalysis.perQuestionEmotions.map((qe, idx) => 
  `Q${qe.questionNumber}: ${qe.dominantEmotion} (confidence: ${qe.confidence}%)`
).join('\n')}

IDEAL INTERVIEW EMOTION PROFILE:
- Neutral: 60-70% (Professional baseline)
- Happy: 20-30% (Strategic enthusiasm)
- Other: <10% (Minimal stress/negative emotions)

CANDIDATE'S PROFILE:
- Neutral: ${emotionAnalysis.rawData.neutralPct}%
- Happy: ${emotionAnalysis.rawData.happyPct}%
- Fearful: ${emotionAnalysis.rawData.fearfulPct}%
- Sad/Angry: ${emotionAnalysis.rawData.sadPct + emotionAnalysis.rawData.angryPct}%
` : ''}

COMMUNICATION ANALYSIS SUMMARY:
${avgCommunicationScore ? `
- Overall Communication: ${avgCommunicationScore.overall}/10
- Clarity: ${avgCommunicationScore.clarity}/10
- Pace: ${avgCommunicationScore.pace}/10
- Confidence: ${avgCommunicationScore.confidence}/10
- Fluency: ${avgCommunicationScore.fluency}/10
- Professional Tone: ${avgCommunicationScore.professionalTone}/10
` : 'Communication analysis not available'}

DETAILED QUESTION ANALYSIS:
${answers.map((answer, index) => `
Question ${index + 1}: ${sessionData.questions?.[index]?.question || 'Question text not available'}
Verbal Answer: ${answer.verbalAnswer || 'No verbal answer'}
Written Answer: ${answer.writtenAnswer || 'No written answer'}
Score: ${answer.evaluation?.score || 0}/20
${emotionAnalysis?.perQuestionEmotions?.[index] ? 
  `Emotional State: ${emotionAnalysis.perQuestionEmotions[index].dominantEmotion} (${emotionAnalysis.perQuestionEmotions[index].confidence}% confidence)` : ''}
Communication Score: ${answer.evaluation?.communicationScore?.overall || 'NA'}/10
Speech Analysis: ${answer.speechAnalysisData ? 
  `WPM: ${answer.speechAnalysisData.wordsPerMinute}, Filler Words: ${answer.speechAnalysisData.fillerWordCount}, Clarity: ${answer.speechAnalysisData.clarity}` : 
  'Not available'}
Strengths: ${answer.evaluation?.strengths?.join(', ') || 'NA'}
Improvements: ${answer.evaluation?.improvements?.join(', ') || 'NA'}
`).join('\n')}

IMPORTANT: Return ONLY a valid JSON object with this exact structure (no markdown, no extra text):
{
  "overallScore": ${percentage},
  "grade": "${grade}",
  "summary": "Comprehensive summary including communication AND emotional intelligence assessment...",
  "topStrengths": ["detailed strength 1", "detailed strength 2", "detailed strength 3"],
  "keyImprovements": ["improvement area 1", "improvement area 2"],
  "recommendations": ["career recommendation 1", "career recommendation 2"],
  "nextSteps": {
    "immediate": ["immediate action 1", "immediate action 2"],
    "development": ["development action 1", "development action 2"]
  },
  "industryReadiness": "Assessment of industry readiness...",
  "careerGuidance": "Personalized career advice...",
  "studyPlan": ["study topic 1", "study topic 2"],
  ${emotionAnalysis ? `
  "emotionalIntelligence": {
    "overallRating": "${emotionAnalysis.professionalComposure >= 80 ? 'Excellent' : emotionAnalysis.professionalComposure >= 60 ? 'Good' : 'Needs Improvement'}",
    "emotionalStability": ${emotionAnalysis.emotionalStability},
    "professionalComposure": ${emotionAnalysis.professionalComposure},
    "confidenceLevel": ${emotionAnalysis.confidenceLevel},
    "stressLevel": "${emotionAnalysis.stressLevel}",
    "interpretation": "Interpretation of emotional profile...",
    "strengths": ["emotional strength 1", "emotional strength 2"],
    "improvements": ["emotional improvement 1", "emotional improvement 2"],
    "comparison": "How candidate's emotional profile compares to ideal interview behavior"
  },
  ` : ''}
  "communicationAnalysis": {
    "overallRating": ${avgCommunicationScore?.overall || 0},
    "keyStrengths": ["communication strength 1", "communication strength 2"],
    "areasForImprovement": ["communication improvement 1", "communication improvement 2"],
    "speechPatterns": "Analysis of speech patterns and delivery",
    "professionalPresence": "Assessment of professional presence",
    "recommendations": ["communication recommendation 1"]
  },
  "detailedQuestionAnalysis": [
    ${answers.map((answer, index) => `{
      "questionNumber": ${index + 1},
      "question": "${sessionData.questions?.[index]?.question?.replace(/"/g, '\\"') || 'Question not available'}",
      "verbalAnswer": "${answer.verbalAnswer?.replace(/"/g, '\\"').substring(0, 200) || ''}...",
      "writtenAnswer": "${answer.writtenAnswer?.replace(/"/g, '\\"') || ''}",
      "score": ${answer.evaluation?.score || 0},
      "feedback": "${answer.evaluation?.feedback?.replace(/"/g, '\\"') || ''}",
      ${emotionAnalysis?.perQuestionEmotions?.[index] ? 
        `"emotionalState": "${emotionAnalysis.perQuestionEmotions[index].dominantEmotion}",
        "emotionalConfidence": ${emotionAnalysis.perQuestionEmotions[index].confidence},` : ''}
      "communicationMetrics": {
        "wpm": ${answer.speechAnalysisData?.wordsPerMinute || 0},
        "fillerWords": ${answer.speechAnalysisData?.fillerWordCount || 0},
        "clarity": "${answer.speechAnalysisData?.clarity || 'Unknown'}",
        "confidence": ${answer.evaluation?.communicationScore?.confidence || 0}
      }
    }`).join(',')}
  ]
}`;

    console.log('Generating comprehensive report with Gemini 2.5 Flash-Lite...');

    let report;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        const result = await model.generateContent(reportPrompt);
        const response = await result.response;
        const responseText = response.text();
        
        if (typeof responseText === 'string') {
          const cleanedResponse = cleanJsonResponse(responseText);
          report = typeof cleanedResponse === 'string' ? JSON.parse(cleanedResponse) : cleanedResponse;
        } else {
          report = responseText;
        }
        
        if (!report.summary || !report.topStrengths) {
          throw new Error('Invalid report structure from Gemini 2.5');
        }
        
        console.log('Report parsed successfully');
        break;
        
      } catch (parseError) {
        attempts++;
        console.error(`Report parse attempt ${attempts} failed:`, parseError.message);
        
        if (attempts >= maxAttempts) {
          // Rollback status on failure
          await sessionRef.update({ 
            status: 'error',
            error: 'Failed to generate report - JSON parsing failed'
          });
          throw new Error('Failed to generate report with Gemini 2.5 - JSON parsing failed');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const finalReport = {
      ...report,
      communicationScores: avgCommunicationScore,
      emotionAnalysis: emotionAnalysis,
      totalAnswers: answers.length,
      aiModel: 'gemini-2.5-flash-lite',
      generatedAt: new Date().toISOString()
    };

    // ✅ SIMPLE FIX: Count actual completed sessions instead of increment
    if (sessionData.templateId) {
      const templateRef = admin.firestore()
        .collection('interviewTemplates')
        .doc(sessionData.templateId);
      
      // ✅ Count all completed sessions for this template (BEFORE marking current as completed)
      const completedSessionsSnapshot = await admin.firestore()
        .collection('sessions')
        .where('templateId', '==', sessionData.templateId)
        .where('userId', '==', userId)
        .where('status', '==', 'completed')
        .count()
        .get();
      
      // ✅ Add 1 for the current session being completed
      const actualAttemptCount = completedSessionsSnapshot.data().count + 1;
      
      console.log(`Template ${sessionData.templateId} - Actual attempt count: ${actualAttemptCount}`);

      // Check template exists and belongs to user
      const templateDoc = await templateRef.get();
      
      if (templateDoc.exists && templateDoc.data().userId === userId) {
        // ✅ Use transaction with ALL reads before writes
        await admin.firestore().runTransaction(async (transaction) => {
          // STEP 1: ALL READS FIRST
          const sessionSnapshot = await transaction.get(sessionRef);
          const templateSnapshot = await transaction.get(templateRef);
          
          // Verify documents still exist
          if (!sessionSnapshot.exists) {
            throw new Error('Session document no longer exists');
          }
          
          if (!templateSnapshot.exists) {
            throw new Error('Template document no longer exists');
          }
          
          // STEP 2: ALL WRITES AFTER
          // Update session with final report
          transaction.update(sessionRef, {
            finalReport: finalReport,
            status: 'completed',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // ✅ Update template with ACTUAL count (not increment)
          transaction.update(templateRef, {
            attemptCount: actualAttemptCount, // Direct value, not increment!
            lastScore: percentage,
            lastGrade: grade,
            lastSessionId: sessionId,
            lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        
        console.log('✅ Transaction completed - session and template updated with count:', actualAttemptCount);
      } else {
        // Template doesn't exist or doesn't belong to user - just update session
        await sessionRef.update({
          finalReport: finalReport,
          status: 'completed',
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('⚠️ Template not found or unauthorized - only session updated');
      }
    } else {
      // No template - just update session
      await sessionRef.update({
        finalReport: finalReport,
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log('✅ Session completed (no template associated)');
    }

    console.log('Report generated and saved successfully');
    return finalReport;

  } catch (error) {
    console.error('Error generating report:', error);
    
    // Rollback status on error
    try {
      await admin.firestore().collection('sessions').doc(request.data.sessionId).update({
        status: 'error',
        error: error.message
      });
    } catch (rollbackError) {
      console.error('Failed to rollback session status:', rollbackError);
    }
    
    throw new Error(error.message || 'Failed to generate report');
  }
});



// NEW: Advanced Speech-to-Text with Communication Analysis
exports.speechToTextAdvanced = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    const { audioData, sessionId, questionId } = request.data;
    console.log('Processing advanced speech analysis for session:', sessionId, 'question:', questionId);

    const sttRequest = {
      audio: { content: audioData },
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        enableWordConfidence: true,
        enableWordTimeOffsets: true,
        enableSpeakerDiarization: false,
        diarizationSpeakerCount: 1,
        model: 'phone_call', // Better for interview audio
        useEnhanced: true
      }
    };

    const [response] = await speechClient.recognize(sttRequest);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    console.log('Advanced speech transcription completed:', transcription.substring(0, 100) + '...');

    // Detailed speech analysis
    let speechAnalysis = {
      confidence: 0,
      wordCount: 0,
      fillerWords: [],
      fillerWordCount: 0,
      wordsPerMinute: 0,
      totalDuration: 0,
      averageWordConfidence: 0,
      clarity: 'Unknown',
      fluency: 'Unknown',
      pauseCount: 0,
      longPauses: 0,
      speechPace: 'Normal'
    };

    if (response.results.length > 0) {
      const words = [];
      let totalConfidence = 0;
      let fillerWords = [];
      let totalDuration = 0;
      let pauseCount = 0;
      let longPauses = 0;
      let lastEndTime = 0;

      // Comprehensive filler word list
      const fillerWordsList = [
        'um', 'uh', 'like', 'you know', 'actually', 'basically', 'literally', 
        'so', 'well', 'right', 'okay', 'erm', 'ah', 'hmm', 'yeah'
      ];

      response.results.forEach(result => {
        if (result.alternatives[0].words) {
          result.alternatives[0].words.forEach(wordInfo => {
            words.push(wordInfo);
            totalConfidence += wordInfo.confidence || 0;
            
            // Check for filler words
            const word = wordInfo.word.toLowerCase().replace(/[^\w]/g, '');
            if (fillerWordsList.includes(word)) {
              fillerWords.push(word);
            }
            
            // Calculate duration and pauses
            if (wordInfo.endTime && wordInfo.startTime) {
              const startTime = parseFloat(wordInfo.startTime.seconds || 0) + (wordInfo.startTime.nanos || 0) / 1e9;
              const endTime = parseFloat(wordInfo.endTime.seconds || 0) + (wordInfo.endTime.nanos || 0) / 1e9;
              const duration = endTime - startTime;
              totalDuration += duration;
              
              // Check for pauses (gaps between words)
              if (lastEndTime > 0) {
                const gap = startTime - lastEndTime;
                if (gap > 0.3) { // Pause longer than 300ms
                  pauseCount++;
                  if (gap > 1.0) { // Long pause longer than 1s
                    longPauses++;
                  }
                }
              }
              lastEndTime = endTime;
            }
          });
        }
      });

      const avgConfidence = words.length > 0 ? totalConfidence / words.length : 0;
      const wordsPerMinute = totalDuration > 0 ? Math.round((words.length / (totalDuration / 60))) : 0;
      const fillerPercentage = words.length > 0 ? (fillerWords.length / words.length) * 100 : 0;

      speechAnalysis = {
        confidence: Math.round(avgConfidence * 100) / 100,
        wordCount: words.length,
        fillerWords: fillerWords,
        fillerWordCount: fillerWords.length,
        fillerPercentage: Math.round(fillerPercentage * 100) / 100,
        wordsPerMinute: wordsPerMinute,
        totalDuration: Math.round(totalDuration * 100) / 100,
        averageWordConfidence: avgConfidence,
        clarity: avgConfidence > 0.8 ? 'High' : avgConfidence > 0.6 ? 'Medium' : 'Low',
        fluency: fillerPercentage < 5 ? 'Excellent' : fillerPercentage < 10 ? 'Good' : 'Needs Improvement',
        pauseCount: pauseCount,
        longPauses: longPauses,
        speechPace: wordsPerMinute > 160 ? 'Fast' : wordsPerMinute < 120 ? 'Slow' : 'Normal'
      };
    }

    console.log('Speech analysis completed:', speechAnalysis);

    return { 
      transcription,
      speechAnalysis 
    };

  } catch (error) {
    console.error('Error in advanced speech-to-text:', error);
    throw new Error(error.message || 'Failed to transcribe and analyze audio');
  }
});

// Create Interview Session - NO increment here
exports.createInterviewSession = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    const { applicationId, sessionId, jobRole, questions, criteria, templateId } = request.data;
    const userId = request.auth.uid;
    
    console.log('Creating interview session:', sessionId, 'for application:', applicationId, 'template:', templateId);

    // Get application data if not provided
    let appData = { jobRole, questions, criteria };
    if (applicationId && (!jobRole || !questions)) {
      const appDoc = await admin.firestore().collection('applications').doc(applicationId).get();
      
      if (!appDoc.exists) {
        throw new Error('Application not found');
      }
      
      const appDocData = appDoc.data();
      // Verify user owns this application
      if (appDocData.userId !== userId) {
        throw new Error('Unauthorized access to application');
      }
      
      appData = appDocData;
    }

    const finalSessionId = sessionId || `session_${Date.now()}_${userId}`;

    // Create session document with userId - NO INCREMENT HERE
    await admin.firestore().collection('sessions').doc(finalSessionId).set({
      userId,
      sessionId: finalSessionId,
      applicationId: applicationId || null,
      templateId: templateId || null,
      jobRole: appData.jobRole,
      questions: appData.questions,
      criteria: appData.criteria,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active', // Mark as active, not completed
      currentQuestionIndex: 0,
      totalQuestions: appData.questions?.length || 5
    });

    console.log('Interview session created:', finalSessionId);
    return { sessionId: finalSessionId };

  } catch (error) {
    console.error('Error creating interview session:', error);
    throw new Error(error.message || 'Failed to create session');
  }
});

exports.getUserInterviewTemplates = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    const userId = request.auth.uid;
    console.log('Fetching interview templates for user:', userId);

    const templatesSnapshot = await admin.firestore()
      .collection('interviewTemplates')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const templates = templatesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      lastAttemptAt: doc.data().lastAttemptAt?.toDate?.() || doc.data().lastAttemptAt
    }));

    console.log('Found', templates.length, 'templates for user');
    return { templates };

  } catch (error) {
    console.error('Error fetching user templates:', error);
    throw new Error(error.message || 'Failed to fetch templates');
  }
});

exports.getInterviewTemplate = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    const { templateId } = request.data;
    const userId = request.auth.uid;

    console.log('Fetching template:', templateId, 'for user:', userId);

    const templateDoc = await admin.firestore()
      .collection('interviewTemplates')
      .doc(templateId)
      .get();

    if (!templateDoc.exists) {
      throw new Error('Template not found');
    }

    const templateData = templateDoc.data();

    // Verify user owns this template
    if (templateData.userId !== userId) {
      throw new Error('Unauthorized access to template');
    }

    console.log('Template fetched successfully');
    return {
      id: templateDoc.id,
      ...templateData,
      createdAt: templateData.createdAt?.toDate?.() || templateData.createdAt,
      lastAttemptAt: templateData.lastAttemptAt?.toDate?.() || templateData.lastAttemptAt
    };

  } catch (error) {
    console.error('Error fetching template:', error);
    throw new Error(error.message || 'Failed to fetch template');
  }
});

exports.saveAnswerToFirestore = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    const { sessionId, answerData } = request.data;
    const userId = request.auth.uid;

    console.log('Saving answer to Firestore for session:', sessionId, 'question:', answerData.questionId);

    // Verify user owns the session
    const sessionDoc = await admin.firestore().collection('sessions').doc(sessionId).get();
    if (!sessionDoc.exists) {
      throw new Error('Session not found');
    }

    const sessionData = sessionDoc.data();
    if (sessionData.userId !== userId) {
      throw new Error('Unauthorized access to session');
    }

    // Save audio to Cloud Storage if provided
    let audioUrl = null;
    if (answerData.audioData) {
      try {
        const bucket = admin.storage().bucket();
        const fileName = `answers/${sessionId}/question_${answerData.questionId}_audio.webm`;
        const file = bucket.file(fileName);

        // Convert base64 to buffer
        const audioBuffer = Buffer.from(answerData.audioData, 'base64');

        await file.save(audioBuffer, {
          metadata: {
            contentType: 'audio/webm',
            metadata: {
              sessionId,
              questionId: answerData.questionId.toString(),
              userId
            }
          }
        });

        // Get download URL
        const [url] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
        });

        audioUrl = url;
        console.log('Audio saved to Cloud Storage:', fileName);
      } catch (audioError) {
        console.error('Error saving audio to storage:', audioError);
        // Continue without audio URL - don't fail the entire operation
      }
    }

    // Prepare answer data for Firestore with userId
    const answerDocData = {
      ...answerData,
      audioUrl,
      userId,
      sessionId,
      savedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Remove raw audio data from Firestore document
    delete answerDocData.audioData;

    // Save answer to Firestore subcollection
    await admin.firestore()
      .collection('sessions')
      .doc(sessionId)
      .collection('answers')
      .doc(answerData.questionId.toString())
      .set(answerDocData);

    // Update session progress - NO increment here, just progress tracking
    await admin.firestore()
      .collection('sessions')
      .doc(sessionId)
      .update({
        currentQuestionIndex: admin.firestore.FieldValue.increment(1),
        lastAnsweredAt: admin.firestore.FieldValue.serverTimestamp()
      });

    console.log('Answer saved successfully to Firestore');
    return { success: true, audioUrl };

  } catch (error) {
    console.error('Error saving answer to Firestore:', error);
    throw new Error(error.message || 'Failed to save answer');
  }
});

exports.textToSpeech = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    const { text, questionId, sessionId } = request.data;
    console.log('Converting text to speech for session:', sessionId, 'question:', questionId);

    const ttsRequest = {
      input: { text },
      voice: {
        languageCode: 'en-IN',
        name: 'en-IN-Chirp3-HD-Charon'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.92,
        pitch: 0.0,
        effectsProfileId: ['headphone-class-device']  // Enhanced audio
      }
    };

    const [response] = await ttsClient.synthesizeSpeech(ttsRequest);

    // Save audio to Cloud Storage
    const bucket = admin.storage().bucket();
    const fileName = `tts/${sessionId}/question_${questionId}.mp3`;
    const file = bucket.file(fileName);

    await file.save(response.audioContent, {
      metadata: {
        contentType: 'audio/mpeg'
      }
    });

    // Get download URL
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
    });

    console.log('TTS audio generated and saved successfully');
    return { audioUrl: url };

  } catch (error) {
    console.error('Error in text-to-speech:', error);
    throw new Error(error.message || 'Failed to generate audio');
  }
});

exports.deleteInterviewTemplate = onCall(async (request) => {
  try {
    if (!request.auth) {
      throw new Error('User must be authenticated');
    }

    const { templateId } = request.data;
    const userId = request.auth.uid;

    console.log('Deleting template:', templateId, 'for user:', userId);

    // Verify user owns this template
    const templateDoc = await admin.firestore()
      .collection('interviewTemplates')
      .doc(templateId)
      .get();

    if (!templateDoc.exists) {
      throw new Error('Template not found');
    }

    const templateData = templateDoc.data();
    if (templateData.userId !== userId) {
      throw new Error('Unauthorized access to template');
    }

    // Delete the template
    await admin.firestore()
      .collection('interviewTemplates')
      .doc(templateId)
      .delete();

    console.log('Template deleted successfully');
    return { success: true };

  } catch (error) {
    console.error('Error deleting template:', error);
    throw new Error(error.message || 'Failed to delete template');
  }
});
