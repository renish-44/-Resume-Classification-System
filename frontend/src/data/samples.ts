/* ============================================================================
 * SYNTHETIC SAMPLE RESUMES
 * ============================================================================
 * All three samples below are FICTIONAL and were written for this demo.
 * They are not real people, companies or job postings. Any resemblance to a
 * real resume is coincidental.
 * ========================================================================== */

export interface SampleResume {
  id: string;
  /** Short label shown on the "Load sample" button. */
  label: string;
  /** One-line description of what the sample illustrates. */
  description: string;
  /** Text only (not a Category) so we never imply a verified prediction. */
  contentType: 'Built-in synthetic sample';
  text: string;
}

export const SAMPLE_RESUMES: SampleResume[] = [
  {
    id: 'software-engineer',
    label: 'Software engineer',
    description: 'Backend-leaning engineering CV, written from scratch for this demo.',
    contentType: 'Built-in synthetic sample',
    text: `Jordan Alvarez
Software Engineer

SUMMARY
Backend engineer with six years building and operating distributed services.
Comfortable owning a feature from API design to on-call runbooks.

SKILLS
Python, Java, Go, PostgreSQL, Redis, Kafka, Docker, Kubernetes, AWS, Terraform,
CI/CD, REST APIs, GraphQL, Git, Linux, GitHub Actions, microservices

EXPERIENCE
Senior Software Engineer - Northwind Logistics (2021 - present)
- Rebuilt the order ingestion service in Java and Kafka, cutting end-to-end latency
  from 1.8s to 240ms at roughly 40k requests per second.
- Introduced Terraform modules for infrastructure reuse across three teams.
- Migrated 60 services to Kubernetes with zero customer-visible downtime.

Software Engineer - Brightpath Media (2019 - 2021)
- Built a React and Node.js dashboard used daily by 300 internal users.
- Wrote the CI/CD pipeline that cut release time from days to under an hour.

EDUCATION
B.S. Computer Science, University of Northern Colorado

LANGUAGES
English (native), Spanish (professional)`,
  },
  {
    id: 'data-scientist',
    label: 'Data scientist',
    description: 'Analytics-heavy CV with modelling and experimentation experience.',
    contentType: 'Built-in synthetic sample',
    text: `Priya Raman
Data Scientist

SUMMARY
Data scientist focused on applied machine learning, experiment design and
communicating model results to non-technical stakeholders.

SKILLS
Python, pandas, NumPy, scikit-learn, PyTorch, TensorFlow, XGBoost, SQL, Spark,
Tableau, statistics, A/B testing, causal inference, time series forecasting,
data visualisation, MLOps

EXPERIENCE
Data Scientist - Helio Retail Group (2022 - present)
- Built a demand forecasting model that reduced stock-out incidents by 18%.
- Deployed an internal recommendation service using PyTorch and a feature store.
- Designed the experimentation framework now used by all growth teams.

Data Analyst - Cobalt Insurance (2020 - 2022)
- Automated weekly reporting in SQL and Python, removing 20 hours of manual work.
- Built a churn model with recall prioritized over precision for the retention team.

EDUCATION
M.S. Applied Statistics, Illinois Institute of Technology
B.S. Mathematics, University of Illinois Chicago

PUBLICATIONS
One workshop on interpretable gradient boosting for tabular data`,
  },
  {
    id: 'hr-recruiter',
    label: 'HR / recruiter',
    description: 'People-operations CV with sourcing and compliance exposure.',
    contentType: 'Built-in synthetic sample',
    text: `Marisol Okonkwo
Human Resources Business Partner

SUMMARY
HR generalist with eight years across talent acquisition, employee relations and
compliance. Known for structured interviews and clear, documented decisions.

SKILLS
Recruiting, onboarding, performance management, employee relations, labor
compliance, applicant tracking systems, interview design, workforce planning,
SHRM-CP, policy development, conflict resolution, onboarding programs

EXPERIENCE
HR Business Partner - Lakeshore Manufacturing (2020 - present)
- Reduced time-to-hire by 22% by rebuilding the interview loop and scorecards.
- Own the employee relations case workflow for a 900-person site.
- Partnered with department leads on a skills-based workforce plan for four plants.

Talent Acquisition Specialist - Ardent Retail (2017 - 2020)
- Screened 1,200+ applicants per quarter and ran structured first-round interviews.
- Updated equal-opportunity and data-privacy language in the applicant tracking system.

EDUCATION
B.A. Organizational Psychology, Universidad de Puerto Rico

CERTIFICATIONS
SHRM-CP, SHRM-SCP (in progress)`,
  },
];
