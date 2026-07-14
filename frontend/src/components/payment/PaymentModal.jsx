// src/components/payment/PaymentModal.jsx
import React, { useState } from 'react';
import { X, CreditCard, Loader, ExternalLink, CheckCircle } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../../firebase';
import useStore from '../../store/useStore';
import toast from 'react-hot-toast';

export default function PaymentModal({ plan, billingCycle, onClose }) {
  const [processing, setProcessing] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const { setSubscription } = useStore();

  const amount = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;

  const handlePayment = async () => {
    if (!auth.currentUser) {
      toast.error('Please sign in to continue');
      return;
    }

    setProcessing(true);

    try {
      // Call Firebase Function to get payment link
      const createPaymentLink = httpsCallable(functions, 'createPaymentLink');
      const result = await createPaymentLink({
        planId: plan.id,
        billingCycle
      });

      const { paymentUrl } = result.data;

      // Open payment page in new window
      const paymentWindow = window.open(paymentUrl, '_blank', 'width=800,height=600');
      
      if (!paymentWindow) {
        toast.error('Please allow popups for this site');
        setProcessing(false);
        return;
      }

      toast.success('Payment page opened! Complete payment in the new window.', {
        duration: 5000
      });

      // Start checking for payment completion
      startPaymentStatusCheck();

    } catch (error) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Failed to initiate payment');
      setProcessing(false);
    }
  };

  const startPaymentStatusCheck = () => {
    setCheckingStatus(true);
    
    // Check every 5 seconds for 5 minutes
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes
    
    const checkInterval = setInterval(async () => {
      attempts++;
      
      try {
        const checkStatus = httpsCallable(functions, 'checkSubscriptionStatus');
        const statusResult = await checkStatus();
        
        console.log('Checking subscription status:', statusResult.data);
        
        // If subscription is active and matches the plan
        if (statusResult.data.isSubscribed && statusResult.data.plan === plan.id) {
          clearInterval(checkInterval);
          
          // Update local store
          setSubscription(statusResult.data);
          
          // Show success
          toast.success('🎉 Payment successful! Your plan is now active.', {
            duration: 5000
          });
          
          setCheckingStatus(false);
          setProcessing(false);
          
          // Close modal and refresh page
          onClose();
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
        
        // Stop checking after max attempts
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setCheckingStatus(false);
          setProcessing(false);
          toast('Payment pending. Refresh page to see updated status.', {
            icon: '⏳'
          });
        }
        
      } catch (error) {
        console.error('Status check error:', error);
      }
    }, 5000); // Check every 5 seconds
    
    // Store interval ID for cleanup
    window.paymentCheckInterval = checkInterval;
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (window.paymentCheckInterval) {
        clearInterval(window.paymentCheckInterval);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          disabled={processing}
        >
          <X className="h-6 w-6" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-4">
            <CreditCard className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Upgrade to {plan.name}
          </h2>
          <p className="text-gray-600">
            {checkingStatus 
              ? 'Waiting for payment completion...' 
              : 'Secure payment via Razorpay'}
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-6 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Plan</span>
            <span className="font-semibold text-gray-900 capitalize">{plan.name}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Billing</span>
            <span className="font-semibold text-gray-900 capitalize">{billingCycle}</span>
          </div>
          <div className="border-t border-gray-200 my-3"></div>
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-gray-900">Total</span>
            <span className="text-2xl font-bold text-gray-900">₹{amount}</span>
          </div>
        </div>

        {checkingStatus && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center space-x-3">
              <Loader className="h-5 w-5 text-blue-600 animate-spin" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">
                  Checking payment status...
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Complete payment in the new window. We'll detect it automatically.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handlePayment}
          disabled={processing}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {processing && !checkingStatus ? (
            <>
              <Loader className="h-5 w-5 animate-spin" />
              <span>Opening payment page...</span>
            </>
          ) : checkingStatus ? (
            <>
              <CheckCircle className="h-5 w-5" />
              <span>Waiting for payment...</span>
            </>
          ) : (
            <>
              <ExternalLink className="h-5 w-5" />
              <span>Proceed to Payment</span>
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          🔒 Secure payment powered by Razorpay
        </p>
      </div>
    </div>
  );
}
