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
- <img width="1402" height="667" alt="T1" src="https://github.com/user-attachments/assets/1a0eba30-4834-4806-9e26-19dbfb069c48" />
- <img width="1257" height="617" alt="T6" src="https://github.com/user-attachments/assets/71abe0b2-0f40-4217-822c-7ca53b354a4f" />
<img width="1410" height="676" alt="T5" src="https://github.com/user-attachments/assets/5fed76e5-3e6c-4021-96e4-73b1cfe48d25" />
<img width="1421" height="687" alt="T4" src="https://github.com/user-attachments/assets/f0eff117-0dca-4700-ac73-9c77d4d66fd5" />
<img width="1282" height="637" alt="T3" src="https://github.com/user-attachments/assets/b849cf12-b7d0-484b-9103-8f3491b6292a" />
<img width="1300" height="602" alt="T2" src="https://github.com/user-attachments/assets/7a2fd42e-b08e-40ae-b851-d56b6fd7fa65" />


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


