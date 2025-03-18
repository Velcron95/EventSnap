import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { CustomAlert } from './CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { UploadSuccessIndicator } from './UploadSuccessIndicator';

export const ExampleScreen = () => {
  const { alertProps, showAlert } = useCustomAlert();
  const [showSuccess, setShowSuccess] = useState(false);

  const showSuccessAnimation = () => {
    setShowSuccess(true);
  };

  const handleAnimationComplete = () => {
    setShowSuccess(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>UI Component Examples</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custom Alerts</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.successButton]} 
            onPress={() => 
              showAlert({
                type: 'success',
                title: 'Success',
                message: 'Operation completed successfully!'
              })
            }
          >
            <Text style={styles.buttonText}>Success</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.errorButton]} 
            onPress={() => 
              showAlert({
                type: 'error',
                title: 'Error',
                message: 'Something went wrong. Please try again.'
              })
            }
          >
            <Text style={styles.buttonText}>Error</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.button, styles.infoButton]} 
            onPress={() => 
              showAlert({
                type: 'info',
                title: 'Information',
                message: 'This is some useful information about the app.'
              })
            }
          >
            <Text style={styles.buttonText}>Info</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.warningButton]} 
            onPress={() => 
              showAlert({
                type: 'warning',
                title: 'Warning',
                message: 'This action may have consequences. Are you sure?',
                confirmText: 'Yes, Continue',
                cancelText: 'Cancel',
                onConfirm: () => console.log('User confirmed'),
                onCancel: () => console.log('User canceled')
              })
            }
          >
            <Text style={styles.buttonText}>Warning</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upload Success Indicator</Text>
        <TouchableOpacity 
          style={[styles.button, styles.successButton, styles.fullWidthButton]} 
          onPress={showSuccessAnimation}
        >
          <Text style={styles.buttonText}>Show Upload Success</Text>
        </TouchableOpacity>
      </View>

      {/* Always include the components at the root level */}
      <CustomAlert {...alertProps} />
      <UploadSuccessIndicator 
        visible={showSuccess}
        onAnimationComplete={handleAnimationComplete}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 30,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 5,
  },
  fullWidthButton: {
    marginHorizontal: 0,
  },
  successButton: {
    backgroundColor: '#4CAF50',
  },
  errorButton: {
    backgroundColor: '#F44336',
  },
  infoButton: {
    backgroundColor: '#2196F3',
  },
  warningButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
}); 