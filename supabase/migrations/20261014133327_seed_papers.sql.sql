-- Seed 12,000 papers across 12 research domains (1000 each)
-- Papers are shared reference data — all authenticated users can see and save them.

INSERT INTO papers (
  title,
  abstract,
  doi,
  source_id,
  source_provider,
  publication_year,
  publication_type,
  is_open_access,
  open_access_url,
  venue,
  citation_count,
  concepts
)
WITH domain_data AS (
  SELECT
    gs AS id,
    ((gs - 1) % 12) + 1 AS domain_idx,
    -- Topic word from array
    CASE
      WHEN ((gs - 1) % 12) = 0 THEN 'Optimization'
      WHEN ((gs - 1) % 12) = 1 THEN 'Classification'
      WHEN ((gs - 1) % 12) = 2 THEN 'Recognition'
      WHEN ((gs - 1) % 12) = 3 THEN 'Prediction'
      WHEN ((gs - 1) % 12) = 4 THEN 'Detection'
      WHEN ((gs - 1) % 12) = 5 THEN 'Segmentation'
      WHEN ((gs - 1) % 12) = 6 THEN 'Generation'
      WHEN ((gs - 1) % 12) = 7 THEN 'Translation'
      WHEN ((gs - 1) % 12) = 8 THEN 'Reasoning'
      WHEN ((gs - 1) % 12) = 9 THEN 'Planning'
      WHEN ((gs - 1) % 12) = 10 THEN 'Control'
      ELSE 'Analysis'
    END AS topic_word
  FROM generate_series(1, 12000) AS gs
)
SELECT
  -- Title
  CASE (domain_data.id - 1) / 1000
    WHEN 0 THEN 'Deep Learning for ' || topic_word || ' in Neural Networks'
    WHEN 1 THEN 'Quantum ' || topic_word || ': Principles and Applications in Physics'
    WHEN 2 THEN 'CRISPR Gene ' || topic_word || ' in Molecular Biology'
    WHEN 3 THEN 'Climate Change ' || topic_word || ': A Comprehensive Environmental Study'
    WHEN 4 THEN 'Blockchain ' || topic_word || ' in Distributed Ledger Systems'
    WHEN 5 THEN 'Renewable Energy ' || topic_word || ' for Sustainable Development'
    WHEN 6 THEN 'Mental Health ' || topic_word || ' in Clinical Psychology'
    WHEN 7 THEN 'Nanotechnology for ' || topic_word || ' in Materials Science'
    WHEN 8 THEN 'Cybersecurity ' || topic_word || ': Threats and Defense Solutions'
    WHEN 9 THEN 'Robotics ' || topic_word || ' in Autonomous Systems'
    WHEN 10 THEN 'IoT-Based ' || topic_word || ' for Smart Infrastructure'
    ELSE 'Natural Language Processing for ' || topic_word || ' in Computational Linguistics'
  END,
  -- Abstract
  CASE (domain_data.id - 1) / 1000
    WHEN 0 THEN 'This paper presents a novel deep learning approach to ' || topic_word || '. We propose a neural network architecture that leverages attention mechanisms and transformer-based encoding. Experimental results on benchmark datasets demonstrate significant improvements over existing methods, achieving ' || (80 + (domain_data.id % 20)) || '% accuracy. The model shows robust generalization across diverse domains.'
    WHEN 1 THEN 'We investigate quantum ' || topic_word || ' and its implications for computation. Our analysis covers quantum entanglement, superposition, and decoherence. We demonstrate quantum advantage in specific problem classes and discuss pathways to fault-tolerant quantum computing with error correction codes.'
    WHEN 2 THEN 'This study examines CRISPR-Cas9 mediated gene ' || topic_word || ' in model organisms. We report efficient gene editing with ' || (70 + (domain_data.id % 30)) || '% success rate and minimal off-target effects. Our findings have implications for therapeutic applications and genetic disease treatment.'
    WHEN 3 THEN 'We analyze the impact of climate change on ' || topic_word || ' using long-term observational data spanning 30 years. Our results show significant trends in temperature, precipitation, and ecological responses. We discuss mitigation strategies and adaptation measures for vulnerable regions.'
    WHEN 4 THEN 'This paper introduces a blockchain-based framework for ' || topic_word || '. We address scalability, security, and consensus mechanism challenges. Smart contract implementation and decentralized governance are evaluated through simulation studies with ' || (500 + (domain_data.id % 500)) || ' transactions per second.'
    WHEN 5 THEN 'We present advances in renewable energy ' || topic_word || ' for sustainable power generation. Our study evaluates efficiency improvements of ' || (15 + (domain_data.id % 25)) || '% compared to conventional systems. Integration with existing grid infrastructure and energy storage solutions are analyzed.'
    WHEN 6 THEN 'This research explores mental health and ' || topic_word || ' in clinical populations. We conducted a longitudinal study with ' || (100 + (domain_data.id % 900)) || ' participants over 24 months. Results indicate significant improvements in treatment outcomes using evidence-based interventions.'
    WHEN 7 THEN 'We report novel nanotechnology applications for ' || topic_word || '. Synthesis and characterization of nanomaterials with controlled properties are described. Applications in catalysis, sensing, and drug delivery are demonstrated with ' || (85 + (domain_data.id % 15)) || '% efficiency and high reproducibility.'
    WHEN 8 THEN 'This paper addresses cybersecurity challenges in ' || topic_word || '. We propose a multi-layered defense framework combining anomaly detection, encryption, and zero-trust architecture. Evaluation against known attack vectors shows ' || (90 + (domain_data.id % 10)) || '% detection accuracy with low false positive rates.'
    WHEN 9 THEN 'We develop robotics solutions for ' || topic_word || ' in autonomous systems. Our approach combines computer vision, path planning, and reinforcement learning. Real-world deployment demonstrates robust performance in dynamic environments with ' || (92 + (domain_data.id % 8)) || '% success rate.'
    WHEN 10 THEN 'This paper presents an IoT-based ' || topic_word || ' system for smart infrastructure. We design a sensor network architecture with edge computing capabilities. Energy efficiency, latency, and scalability are evaluated under realistic conditions with ' || (1000 + (domain_data.id % 5000)) || ' connected devices.'
    ELSE 'We propose a natural language processing approach for ' || topic_word || '. Our model uses pre-trained language representations fine-tuned on domain-specific data. We achieve ' || (82 + (domain_data.id % 18)) || '% F1 score on standard benchmarks with significant improvements in low-resource scenarios.'
  END,
  -- DOI (about 67% of papers have DOIs)
  CASE WHEN (domain_data.id % 3) != 0
    THEN '10.' || lpad(((domain_data.id * 7) % 9999)::text, 4, '0') || '/seed-' || domain_data.id::text
    ELSE NULL
  END,
  -- source_id
  'seed-' || domain_data.id::text,
  'openalex',
  -- publication_year (1990-2025, weighted toward recent)
  1990 + ((domain_data.id * 7 + 13) % 36),
  -- publication_type
  CASE (domain_data.id % 5)
    WHEN 0 THEN 'proceedings-article'
    WHEN 1 THEN 'review'
    WHEN 2 THEN 'book-chapter'
    ELSE 'article'
  END,
  -- is_open_access (~60% true)
  (domain_data.id % 5) < 3,
  -- open_access_url
  CASE WHEN (domain_data.id % 5) < 3
    THEN 'https://openaccess.example.com/seed-' || domain_data.id::text
    ELSE NULL
  END,
  -- venue
  CASE (domain_data.id - 1) / 1000
    WHEN 0 THEN 'Journal of Machine Learning Research'
    WHEN 1 THEN 'Physical Review Letters'
    WHEN 2 THEN 'Nature Biotechnology'
    WHEN 3 THEN 'Nature Climate Change'
    WHEN 4 THEN 'IEEE Transactions on Blockchain'
    WHEN 5 THEN 'Renewable Energy Journal'
    WHEN 6 THEN 'Journal of Clinical Psychology'
    WHEN 7 THEN 'ACS Nano'
    WHEN 8 THEN 'IEEE Security & Privacy'
    WHEN 9 THEN 'IEEE Transactions on Robotics'
    WHEN 10 THEN 'IEEE Internet of Things Journal'
    ELSE 'Computational Linguistics'
  END,
  -- citation_count
  (domain_data.id * 3 + 17) % 500,
  -- concepts
  CASE (domain_data.id - 1) / 1000
    WHEN 0 THEN ARRAY['Deep Learning', 'Neural Networks', 'Machine Learning', 'Artificial Intelligence']
    WHEN 1 THEN ARRAY['Quantum Computing', 'Quantum Mechanics', 'Quantum Information', 'Physics']
    WHEN 2 THEN ARRAY['CRISPR', 'Gene Editing', 'Molecular Biology', 'Genetics']
    WHEN 3 THEN ARRAY['Climate Change', 'Environmental Science', 'Sustainability', 'Ecology']
    WHEN 4 THEN ARRAY['Blockchain', 'Distributed Systems', 'Cryptography', 'Smart Contracts']
    WHEN 5 THEN ARRAY['Renewable Energy', 'Sustainability', 'Clean Energy', 'Power Systems']
    WHEN 6 THEN ARRAY['Mental Health', 'Psychology', 'Clinical Research', 'Healthcare']
    WHEN 7 THEN ARRAY['Nanotechnology', 'Materials Science', 'Nanoparticles', 'Chemistry']
    WHEN 8 THEN ARRAY['Cybersecurity', 'Information Security', 'Network Security', 'Cryptography']
    WHEN 9 THEN ARRAY['Robotics', 'Autonomous Systems', 'Computer Vision', 'Control Systems']
    WHEN 10 THEN ARRAY['IoT', 'Internet of Things', 'Edge Computing', 'Smart Cities']
    ELSE ARRAY['Natural Language Processing', 'Computational Linguistics', 'Machine Learning', 'AI']
  END
FROM domain_data;
