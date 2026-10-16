# CITADEL — TinyML-Enabled Emergency Monitoring Application

CITADEL is the application component of a larger patent-related emergency monitoring project designed to support wearable safety monitoring and emergency communication in environments where conventional network infrastructure may be unavailable.

The broader system combines wearable sensor data, on-device fall detection, physiological monitoring, and priority-aware emergency communication. The application repository provides the software application and supporting components for the project.

**My contribution focused exclusively on the Machine Learning and TinyML fall-detection model**, including data preprocessing, feature engineering, model training, class-imbalance handling, performance evaluation, and lightweight model deployment.

> **Patent note:** This application forms part of the associated patent-related project. Refer to the official patent documentation for the application number, inventors, ownership, and current legal status.

## 🧠 My Contribution: TinyML Fall Detection

I worked on developing a lightweight neural network to classify wearable motion data into two categories:

- **Fall:** Sensor patterns associated with fall events.
- **Non-fall:** Activities of daily living and other non-fall movements.

The objective was to develop a model that could perform inference on resource-constrained wearable hardware without requiring continuous cloud-based prediction.

### Dataset and Preprocessing

The model development used wrist inertial sensor data from the UP-Fall dataset.

- Segmented sensor measurements into windows of 125 samples at 50 Hz.
- Used a 2.5-second observation window.
- Formulated the task as binary classification: fall versus non-fall.
- Engineered a compact 24-dimensional feature representation from motion signals and temporal statistics.
- Addressed class imbalance using oversampling, feature-space augmentation, and class weighting.
- Used subject-independent evaluation methodology as described in the research work.

### Feature Engineering

The engineered features capture movement intensity, abrupt motion, rotation, and changes in posture.

Examples include:

- Acceleration magnitude and angular velocity magnitude.
- Mean, standard deviation, and range of acceleration magnitude.
- Motion energy and peak count.
- Maximum absolute acceleration.
- Tilt and orientation-related features.
- Jerk and acceleration–angular velocity correlation.
- Additional contextual features derived from sensor measurements.

These features reduce the input dimensionality and make the classification pipeline more suitable for edge inference.

### Model Architecture and Training

The fall detector uses a compact feedforward neural network based on a multilayer perceptron architecture.

The documented model incorporates dense layers, ReLU activations, batch normalization, attention-based feature interaction, residual blocks, and dropout regularization.

Training used categorical cross-entropy, the Adam optimizer, learning-rate scheduling, early stopping, and class weighting to improve fall detection under imbalanced data conditions.

The trained model was evaluated on held-out data and converted to a TensorFlow Lite representation for resource-constrained deployment.

## 📊 Model Evaluation Results

The research document reports the following test-set performance at the selected classification threshold:

| Metric | Reported Result |
|---|---:|
| Accuracy | 97.26% |
| Fall precision | 0.886 |
| Fall recall | 0.897 |
| Fall F1-score | 0.891 |
| ROC-AUC | 0.993 |

These metrics measure the model's classification performance, rather than the performance of the entire application or wireless network.

### Interpretation

- **Accuracy:** Approximately 97.26% of evaluated windows were classified correctly.
- **Precision:** Approximately 88.6% of windows predicted as falls were actual falls.
- **Recall:** Approximately 89.7% of actual fall windows were detected.
- **F1-score:** The model achieved an F1-score of approximately 0.891 for the fall class.
- **ROC-AUC:** The reported value of 0.993 indicates strong discrimination between fall and non-fall classes across classification thresholds.

Recall is particularly important for this use case because missed fall events can prevent timely emergency alerts. Precision is also important because false alarms can generate unnecessary emergency notifications.

### Model Analysis

The research also examines training and validation curves, confusion matrices, feature importance, ROC and precision–recall curves, probability calibration, and feature-reduction experiments.

Permutation importance identified acceleration magnitude, motion energy, peak-related features, and orientation-related features among the important signals for distinguishing falls from ordinary activities.

The model was designed for lightweight inference on embedded hardware, with quantization explored to reduce deployment requirements.

*Reported metrics correspond to the documented dataset and evaluation procedure. Performance on new users, wearable placements, and real-world conditions requires additional validation.*

## 🔄 Machine Learning Workflow

1. Acquire labeled wearable sensor data.
2. Segment the data into fixed-length windows.
3. Extract a compact set of motion and temporal features.
4. Split data for training, validation, and testing.
5. Handle class imbalance in the training pipeline.
6. Train and tune the neural network.
7. Select a classification threshold using validation performance.
8. Evaluate the model using classification metrics and diagnostic plots.
9. Convert the trained model into a lightweight deployment format.
10. Integrate model inference with the wider emergency monitoring workflow where implemented.

## 📱 Application and System Context

The application belongs to the wider CITADEL emergency monitoring project. The broader system is designed around:

- Wearable motion and heart-rate monitoring.
- On-device fall detection using TinyML.
- Priority classification for safety-related events.
- Bluetooth-based communication when available.
- Decentralized, multi-hop emergency communication when conventional infrastructure is unavailable.

The React Native application and backend should be understood as software components of the wider system. The machine learning contribution described in this README is limited to the fall-detection model and its associated experimentation and evaluation.

## 🛠️ Technology Stack

**Machine Learning and TinyML**
- Python
- Neural networks and multilayer perceptrons
- TensorFlow / Keras
- TensorFlow Lite
- NumPy
- Pandas
- Scikit-learn
- Matplotlib

**Application**
- React Native
- TypeScript
- JavaScript
- Node.js
- Prisma

The precise libraries and components required depend on the implementation in the repository and the model-training environment.

## 📂 Repository Structure

```text
CITADEL/
├── android/
├── ios/
├── backend/
├── src/
├── __tests__/
├── fall-accident-detection.ipynb
├── App.tsx
├── package.json
├── package-lock.json
├── README.md
└── .gitignore
```

The notebook shown above is the model experimentation entry point visible in the repository. Other model artifacts, datasets, and supporting files should be documented if they are included or distributed separately.

## ⚠️ Limitations

- Model performance depends on the training data, sensor placement, and movement patterns.
- Results on a research dataset do not guarantee equivalent real-world performance.
- False negatives and false positives remain possible.
- Wearable fall detection should not be treated as a substitute for emergency services or professional medical assessment.
- Patent status and intellectual property claims should be verified against official documentation.

## 🎯 Project Objective

CITADEL explores how a lightweight machine learning model can support wearable fall detection within a broader emergency monitoring system. The ML work focuses on extracting useful motion features, training a compact classifier, evaluating fall-detection performance, and preparing the model for edge deployment.

## 👨‍💻 Contribution Summary

**Primary contribution: Machine Learning, Deep Learning, and TinyML fall detection**

- Sensor-data preprocessing and windowing.
- Feature engineering for fall versus non-fall classification.
- Neural network training and imbalance handling.
- Model evaluation and performance analysis.
- Quantization and lightweight inference considerations.

This section describes the ML contribution and does not claim sole authorship of the broader application, hardware, communication protocol, or patent.

