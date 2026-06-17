# 🚀 FinanceAI: AI-Based Personal Finance Management

FinanceAI is an intelligent, reactive personal finance management platform that goes beyond traditional transaction tracking. By integrating machine learning models, statistical forecasting, and sustainability metrics, it transforms raw financial data into actionable decision-support insights.

## ✨ Key Features

* **AI-Driven Fraud Detection:** Utilizes a Random Forest classifier (supported by SMOTE for class imbalance) to detect anomalous and suspicious transactions in real-time.
* **Predictive Budgeting:** Employs the ARIMA time-series model to forecast next month's spending based on historical transaction patterns.
* **Carbon Footprint Tracking:** Matches standardized Merchant Category Codes (MCC) with emission coefficients to estimate the ecological impact of consumption habits.
* **Geospatial Risk Analysis:** Groups transactions by location to visualize spending distribution and highlight high-risk geographical anomalies.
* **Reactive Ecosystem:** A synchronized architecture where database updates reflect instantly across web and mobile platforms.
* **Secure Authentication Flow:** Features a professional authentication system requiring a manual sign-in step after account creation to ensure explicit user verification and enhanced security.

## 🛠️ Tech Stack

* **Backend / API:** Python, FastAPI
* **Mobile Application:** React Native, Expo
* **Web Interface:** React, Vite, TypeScript
* **Database & Auth:** Supabase (PostgreSQL), JWT, Row Level Security
* **Machine Learning:** Scikit-learn, Statsmodels, Pandas (ARIMA, Random Forest)

## ⚙️ Local Setup & Installation

To run this project locally, you will need to set up the backend API and the frontend/mobile client.

### 1. Environment Variables (.env)
For security reasons, actual API keys and database passwords are not committed to this repository. 
* Locate the `.env.example` files in the root, `frontend/`, `FinanceAI-Mobile/`, and `Dashboard/` directories.
* Copy them and rename them to `.env`.
* Replace the placeholder values (`your_key_here`, `your_local_ip_here`) with your actual Supabase credentials and local IPv4 address.

### 2. Backend (FastAPI) Setup
Navigate to the backend directory and start the Uvicorn server, exposing it to your local network:
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
pip install -r requirements.txt

# Run the server on your local network
python -m uvicorn main:app --host 0.0.0.0 --port 8000
