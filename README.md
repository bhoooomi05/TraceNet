# TraceNet
Trace before you Trust
# TraceNet – Multi-Modal Misinformation Detection

TraceNet is a web-based system that helps identify misinformation from different types of content such as **text, URLs, images, and videos**.

The project combines machine learning models with external verification and visual analysis to give users a prediction, confidence score, and supporting information.

## Features

- Detects misinformation from text and news content
- Analyzes URLs and checks related sources
- Detects AI-generated images
- Detects deepfake videos
- Shows prediction and confidence score
- Cross-checks information using external sources
- Provides explanations for model predictions
- Shows related sources and information flow using interactive graphs
<img width="1257" height="617" alt="T6" src="https://github.com/user-attachments/assets/fc625446-56f7-40a4-9bb7-893a52d041d1" />
<img width="1410" height="676" alt="T5" src="https://github.com/user-attachments/assets/23de2a39-885a-48be-b276-a9b04df23bf9" />
<img width="1421" height="687" alt="T4" src="https://github.com/user-attachments/assets/604c59ab-b1b1-408a-8e8c-81ef917eca19" />
<img width="1282" height="637" alt="T3" src="https://github.com/user-attachments/assets/a587090e-a226-4edc-888e-25fc3df3c1e8" />
<img width="1300" height="602" alt="T2" src="https://github.com/user-attachments/assets/b118c55a-5caa-4777-936c-4a540b229f8d" />
<img width="1402" height="667" alt="T1" src="https://github.com/user-attachments/assets/12c95d87-6559-4bd4-a9a0-22011fab0380" />



The system follows a pipeline from input collection and preprocessing to model prediction, verification, explainability, and final output.

## Machine Learning Models

| Input | Model | Task |
|------|------|------|
| Text | Random Forest | Fake / Real news detection |
| Image | Gradient Boosting | Real / AI-generated detection |
| Video | XGBoost | Real / Deepfake detection |

## How It Works

1. User provides **text, URL, image, or video**.
2. The input is preprocessed according to its type.
3. Relevant features are extracted.
4. The corresponding machine learning model analyzes the input.
5. Results are cross-checked with external sources where applicable.
6. The system generates a prediction with a confidence score.
7. Supporting evidence, explanations, and source relationships are displayed.

## Explainability

TraceNet also shows why content may have been flagged.

- LIME for text-based explanations
- ELA and visual features for images
- Frame and motion analysis for videos
- Supporting sources and evidence

## Information Tracking

One of the main parts of TraceNet is tracking how information is connected across different sources.

The system displays:

- Relevant sources
- Related content
- Source relationships
- Information propagation through network graphs
- Source credibility signals

## Dataset

### Text
- ISOT Fake News Dataset
- LIAR Dataset
- WWFND Dataset
- 20,000+ combined samples

### Images
- AI Generated Images vs Real Images Dataset
- 975 images

### Videos
- Deepfake Videos Dataset
- Real vs AI Video Dataset
- FaceForensics++
- 76 videos used for training and evaluation

## Performance

### Text Model

- Accuracy: **82.53%**
- Precision: **83%**
- Recall: **83%**
- F1-Score: **83%**
- AUC-ROC: **0.9245**

### Image Model

- Accuracy: **71%**
- Precision: **71%**
- Recall: **71%**
- F1-Score: **71%**
- AUC-ROC: **0.78**

### Video Model

- Accuracy: **68.75%**
- AUC-ROC: **0.75**
- Macro F1-Score: **0.6761**

## Tech Stack

- Python
- Scikit-learn
- XGBoost
- OpenCV
- Pandas
- NumPy
- LIME
- Flask
- HTML
- CSS
- JavaScript
- Gemini API
- Fact-Check APIs


