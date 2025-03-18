# Custom Alert System for EventSnap

This document explains how to use the enhanced alert system in the EventSnap application.

## Overview

EventSnap uses a custom alert system built on top of `react-native-modal` that provides better-looking alerts than the default React Native Alert component. The system is designed to be a drop-in replacement for the standard Alert API while providing additional features like:

- Beautiful, customizable UI
- Different alert types (success, error, info, warning)
- Animated transitions
- Better support for multiple buttons
- Consistent styling across the application

## How to Use

### 1. Basic Usage with Alert Utility

The simplest way to use the custom alert system is through the `Alert` utility export:

```typescript
import { Alert } from '../utils/alert';

// Basic usage (similar to React Native's Alert.alert)
Alert.alert(
  'Title',
  'Message',
  [
    { 
      text: 'Cancel', 
      style: 'cancel',
      onPress: () => console.log('Cancel pressed')
    },
    { 
      text: 'OK', 
      style: 'default',
      onPress: () => console.log('OK pressed')
    }
  ]
);
```

### 2. Helper Functions

For common use cases, we provide helper functions that simplify the API:

```typescript
import { showSuccessAlert, showErrorAlert, showConfirmationAlert } from '../utils/alert';

// Success alert
showSuccessAlert(
  'Success',
  'Operation completed successfully!',
  () => console.log('Success alert closed')
);

// Error alert
showErrorAlert(
  'Error',
  'Something went wrong!',
  () => console.log('Error alert closed')
);

// Confirmation alert
showConfirmationAlert(
  'Confirm Delete',
  'Are you sure you want to delete this item?',
  () => console.log('Delete confirmed'),
  () => console.log('Delete cancelled'),
  'Delete', // Custom confirm button text
  'Cancel'  // Custom cancel button text
);
```

### 3. Direct Component Usage

For more complex cases, you can use the `CustomAlert` component directly:

```typescript
import React, { useState } from 'react';
import { CustomAlert } from '../components/CustomAlert';

const MyComponent = () => {
  const [alertVisible, setAlertVisible] = useState(false);
  
  return (
    <>
      <Button 
        title="Show Alert"
        onPress={() => setAlertVisible(true)}
      />
      
      <CustomAlert
        isVisible={alertVisible}
        type="info"
        title="Information"
        message="This is an informational alert"
        onConfirm={() => setAlertVisible(false)}
        onCancel={() => setAlertVisible(false)}
        confirmText="Got it"
        cancelText="Dismiss"
      />
    </>
  );
};
```

## Alert Types

The `CustomAlert` component supports these alert types:

- `success`: Green-themed alert with check icon (for successful operations)
- `error`: Red-themed alert with error icon (for errors and destructive operations)
- `warning`: Orange-themed alert with warning icon (for warning messages)
- `info`: Blue-themed alert with info icon (for informational messages)

## Best Practices

1. **Use Helper Functions**: For common cases, use the helper functions as they make the code more readable.

2. **Use Right Alert Type**: Choose the appropriate alert type based on the message context:
   - `success` for successful operations
   - `error` for error messages
   - `warning` for cautionary messages
   - `info` for neutral information

3. **Clear Titles and Messages**: Write clear, concise titles and messages. The title should summarize the purpose of the alert, and the message should provide additional detail.

4. **Button Text**: Use clear action verbs for buttons. Avoid generic terms like "OK" if a more specific term would be clearer.

5. **Confirmation for Destructive Actions**: Always use a confirmation dialog for destructive actions like deletion.

## Migrating from React Native Alert

To migrate from the default React Native Alert:

1. Import the Alert from utils instead of react-native:
   ```typescript
   import { Alert } from '../utils/alert';
   // instead of 
   // import { Alert } from 'react-native';
   ```

2. For simpler error messages, consider using the helper functions:
   ```typescript
   // Before
   Alert.alert('Error', 'Failed to load data');
   
   // After
   showErrorAlert('Error', 'Failed to load data');
   ```

3. Run your app and verify the alerts look and function correctly with the new implementation. 