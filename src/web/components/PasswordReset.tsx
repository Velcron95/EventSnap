import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export const PasswordReset = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState('request'); // 'request', 'verify', 'success'
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      
      if (error) {
        setError(error.message);
      } else {
        setMessage('Check your email for the password reset code');
        setStep('verify');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    }
  };
  
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'recovery',
      });
      
      if (error) {
        setError(error.message);
      } else {
        setMessage('OTP verified successfully. Set your new password.');
        setStep('reset');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    }
  };
  
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      
      if (error) {
        setError(error.message);
      } else {
        setMessage('Your password has been successfully reset');
        setStep('success');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    }
  };
  
  return (
    <div className="password-reset-container">
      <h2>Reset Your Password</h2>
      
      {error && <div className="error-message">{error}</div>}
      {message && <div className="success-message">{message}</div>}
      
      {step === 'request' && (
        <form onSubmit={handleRequestReset}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="primary-button">
            Send Reset Code
          </button>
        </form>
      )}
      
      {step === 'verify' && (
        <form onSubmit={handleVerifyOTP}>
          <div className="form-group">
            <label htmlFor="otp">Enter the 6-digit code from your email</label>
            <input
              type="text"
              id="otp"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              minLength={6}
              maxLength={6}
              required
            />
          </div>
          <button type="submit" className="primary-button">
            Verify Code
          </button>
        </form>
      )}
      
      {step === 'reset' && (
        <form onSubmit={handlePasswordReset}>
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              required
            />
          </div>
          <button type="submit" className="primary-button">
            Reset Password
          </button>
        </form>
      )}
      
      {step === 'success' && (
        <div className="success-container">
          <p>Your password has been reset successfully.</p>
          <a href="/login" className="link-button">
            Go to Login
          </a>
        </div>
      )}
    </div>
  );
}; 