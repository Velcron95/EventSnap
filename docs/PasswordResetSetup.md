# Password Reset Setup for EventSnap

This guide explains how to set up password reset functionality for both the mobile app and the website.

## 1. Configure Supabase Email Templates

1. Log in to your [Supabase Dashboard](https://app.supabase.io/)
2. Select your project
3. Go to **Authentication** > **Email Templates**
4. Click on the **Reset Password** template
5. Replace the default template with this custom template:

```html
<h2>Reset Your Password</h2>

<p>We received a request to reset your password for EventSnap.</p>

<div style="background-color: #f2f2f2; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
  <h1 style="color: #007AFF; font-size: 36px; letter-spacing: 5px;">{{ .Params.otp }}</h1>
</div>

<p>Enter this code in the app to complete your password reset.</p>

<p>This code will expire in 30 minutes.</p>

<p>If you didn't request this password reset, you can safely ignore this email.</p>

<p>Thank you,<br>
The EventSnap Team</p>
```

6. Click **Save** to apply the changes

## 2. Add Password Reset to the Website

Create a new file `PasswordReset.tsx` in your website's components folder:

```tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

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
```

## 3. Add CSS Styles for Password Reset Page

Add the following CSS styles to your website's styles:

```css
.password-reset-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  background-color: #ffffff;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

.primary-button {
  display: block;
  width: 100%;
  padding: 0.75rem;
  background-color: #007AFF;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.primary-button:hover {
  background-color: #0056b3;
}

.error-message {
  padding: 0.75rem;
  margin-bottom: 1rem;
  background-color: #ffebee;
  color: #d32f2f;
  border-radius: 4px;
}

.success-message {
  padding: 0.75rem;
  margin-bottom: 1rem;
  background-color: #e8f5e9;
  color: #2e7d32;
  border-radius: 4px;
}

.link-button {
  display: inline-block;
  margin-top: 1rem;
  color: #007AFF;
  text-decoration: none;
}

.link-button:hover {
  text-decoration: underline;
}
```

## 4. Add the Reset Password Route

In your website's router configuration, add a route for the password reset page:

```tsx
// In your router file
import { PasswordReset } from '../components/PasswordReset';

// Add this to your routes
<Route path="/reset-password" element={<PasswordReset />} />
```

## 5. Add a "Forgot Password" Link

Add a link to the password reset page in your login form:

```tsx
<div className="forgot-password">
  <a href="/reset-password">Forgot your password?</a>
</div>
```

## Configuration Notes

1. The Supabase email template uses `{{ .Params.otp }}` to display the one-time password
2. The OTP code expires after 30 minutes
3. Make sure your website and mobile app both use the same Supabase project
4. The password reset flow works the same way for both web and mobile clients

## Testing

1. Test the password reset flow on both the website and mobile app
2. Verify that the custom email template is being used
3. Confirm that the OTP verification and password update work correctly 