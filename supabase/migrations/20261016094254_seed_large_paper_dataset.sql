-- Seed 100,000 realistic research papers across 25 research domains (4000 each)
-- Papers are shared reference data — all authenticated users can see and save them.
-- This provides a substantial local dataset for search alongside external APIs.

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
    ((gs - 1) % 25) AS domain_idx,
    ((gs - 1) / 4000) AS domain_block,
    -- Sub-topic variation within each domain
    CASE (gs % 10)
      WHEN 0 THEN 'Survey'
      WHEN 1 THEN 'Experimental'
      WHEN 2 THEN 'Theoretical'
      WHEN 3 THEN 'Comparative'
      WHEN 4 THEN 'Empirical'
      WHEN 5 THEN 'Novel'
      WHEN 6 THEN 'Adaptive'
      WHEN 7 THEN 'Optimized'
      WHEN 8 THEN 'Hybrid'
      ELSE 'Scalable'
    END AS approach_word,
    CASE ((gs / 4) % 10)
      WHEN 0 THEN 'Performance'
      WHEN 1 THEN 'Efficiency'
      WHEN 2 THEN 'Accuracy'
      WHEN 3 THEN 'Robustness'
      WHEN 4 THEN 'Scalability'
      WHEN 5 THEN 'Reliability'
      WHEN 6 THEN 'Generalization'
      WHEN 7 THEN 'Interpretability'
      WHEN 8 THEN 'Convergence'
      ELSE 'Stability'
    END AS metric_word
  FROM generate_series(1, 100000) AS gs
)
SELECT
  -- Title: domain-specific with approach and numbering
  CASE domain_data.domain_idx
    WHEN 0 THEN 'Deep ' || approach_word || ' Learning for Neural ' || metric_word || ' in Computer Vision Systems'
    WHEN 1 THEN approach_word || ' Transformer Models for Language ' || metric_word || ' in NLP'
    WHEN 2 THEN approach_word || ' Reinforcement Learning for ' || metric_word || ' in Autonomous Decision Making'
    WHEN 3 THEN approach_word || ' Graph Neural Networks for ' || metric_word || ' in Network Analysis'
    WHEN 4 THEN 'Federated Learning: ' || approach_word || ' Approaches for Privacy-Preserving ' || metric_word
    WHEN 5 THEN approach_word || ' Transfer Learning for Cross-Domain ' || metric_word || ' in Machine Learning'
    WHEN 6 THEN approach_word || ' Generative Adversarial Networks for ' || metric_word || ' in Image Synthesis'
    WHEN 7 THEN approach_word || ' Attention Mechanisms for ' || metric_word || ' in Sequence Modeling'
    WHEN 8 THEN approach_word || ' Convolutional Neural Networks for ' || metric_word || ' in Medical Imaging'
    WHEN 9 THEN approach_word || ' Natural Language Inference for ' || metric_word || ' in Text Understanding'
    WHEN 10 THEN 'Knowledge Graph Embedding for ' || approach_word || ' ' || metric_word || ' in Reasoning'
    WHEN 11 THEN approach_word || ' Representation Learning for ' || metric_word || ' in Multi-Modal Systems'
    WHEN 12 THEN approach_word || ' Meta-Learning for Few-Shot ' || metric_word || ' in Adaptation'
    WHEN 13 THEN 'Self-Supervised Learning for ' || approach_word || ' ' || metric_word || ' in Visual Recognition'
    WHEN 14 THEN approach_word || ' Diffusion Models for ' || metric_word || ' in Generative AI'
    WHEN 15 THEN approach_word || ' Quantum Machine Learning for ' || metric_word || ' in Quantum Computing'
    WHEN 16 THEN approach_word || ' Edge Computing for ' || metric_word || ' in Distributed Systems'
    WHEN 17 THEN approach_word || ' Blockchain Consensus for ' || metric_word || ' in Decentralized Networks'
    WHEN 18 THEN approach_word || ' Cybersecurity Frameworks for ' || metric_word || ' in Network Defense'
    WHEN 19 THEN approach_word || ' IoT Architectures for ' || metric_word || ' in Smart Infrastructure'
    WHEN 20 THEN approach_word || ' Robotics Control for ' || metric_word || ' in Autonomous Navigation'
    WHEN 21 THEN approach_word || ' Climate Modeling for ' || metric_word || ' in Environmental Prediction'
    WHEN 22 THEN approach_word || ' Bioinformatics for ' || metric_word || ' in Genomic Analysis'
    WHEN 23 THEN approach_word || ' Renewable Energy Optimization for ' || metric_word || ' in Power Systems'
    ELSE approach_word || ' Human-Computer Interaction for ' || metric_word || ' in Interface Design'
  END,
  -- Abstract: domain-specific with realistic methodology descriptions
  CASE domain_data.domain_idx
    WHEN 0 THEN 'We present a ' || LOWER(approach_word) || ' deep learning architecture for improving ' || LOWER(metric_word) || ' in computer vision tasks. Our method leverages multi-scale feature extraction and attention-guided refinement. Experiments on ImageNet, COCO, and CIFAR-10 demonstrate ' || (75 + (domain_data.id % 24)) || '% top-1 accuracy with ' || (12 + (domain_data.id % 40)) || 'M parameters. The proposed architecture achieves state-of-the-art results while reducing computational cost by ' || (20 + (domain_data.id % 35)) || '% compared to existing approaches.'
    WHEN 1 THEN 'This paper introduces a ' || LOWER(approach_word) || ' transformer-based model for language ' || LOWER(metric_word) || '. We pre-train on a large-scale corpus and fine-tune on downstream tasks including text classification, question answering, and named entity recognition. Results show ' || (88 + (domain_data.id % 12)) || '% F1 score on GLUE benchmark, outperforming BERT-base by ' || (3 + (domain_data.id % 8)) || ' points. Analysis of attention patterns reveals interpretable linguistic structures.'
    WHEN 2 THEN 'We propose a ' || LOWER(approach_word) || ' reinforcement learning algorithm for ' || LOWER(metric_word) || ' in sequential decision-making. Our approach combines policy gradient methods with value function approximation. Training on Atari 2600 and MuJoCo environments achieves ' || (90 + (domain_data.id % 10)) || '% average return. The agent demonstrates robust ' || LOWER(metric_word) || ' across varying reward structures and stochastic dynamics.'
    WHEN 3 THEN 'This work introduces a ' || LOWER(approach_word) || ' graph neural network for ' || LOWER(metric_word) || ' in graph-structured data. We design message passing layers that aggregate neighborhood information with learned attention weights. On node classification (Cora, Citeseer, Pubmed) and link prediction tasks, our model achieves ' || (82 + (domain_data.id % 17)) || '% accuracy. We analyze the effect of graph topology on information propagation.'
    WHEN 4 THEN 'We present a ' || LOWER(approach_word) || ' federated learning framework for ' || LOWER(metric_word) || ' across distributed clients. Our approach addresses data heterogeneity through adaptive aggregation and differential privacy guarantees with epsilon=' || (1 + (domain_data.id % 9)) || '. Experiments on federated benchmark datasets show ' || (78 + (domain_data.id % 20)) || '% accuracy while preserving client privacy. Communication efficiency improves by ' || (30 + (domain_data.id % 50)) || '% over FedAvg.'
    WHEN 5 THEN 'This study investigates ' || LOWER(approach_word) || ' transfer learning for cross-domain ' || LOWER(metric_word) || '. We propose a domain adaptation technique that aligns feature distributions using maximum mean discrepancy. Transfer from source to target domain achieves ' || (80 + (domain_data.id % 18)) || '% accuracy with ' || (5 + (domain_data.id % 15)) || '% negative transfer rate. Results are validated on Office-31, DomainNet, and VisDA datasets.'
    WHEN 6 THEN 'We propose a ' || LOWER(approach_word) || ' GAN architecture for ' || LOWER(metric_word) || ' in image generation. Our generator employs progressive growing with spectral normalization. Fréchet Inception Distance of ' || (10 + (domain_data.id % 30)) || ' is achieved on CIFAR-10, with Inception Score of ' || (8 + (domain_data.id % 3)) || '.' || (domain_data.id % 10) || '. Qualitative evaluation shows diverse and high-fidelity samples with mode collapse reduced by ' || (40 + (domain_data.id % 40)) || '%.'
    WHEN 7 THEN 'This paper presents an ' || LOWER(approach_word) || ' attention mechanism for ' || LOWER(metric_word) || ' in sequence modeling. We introduce sparse attention patterns that reduce quadratic complexity to O(n log n). On Long Range Arena and language modeling benchmarks, our approach matches full-attention ' || LOWER(metric_word) || ' while processing sequences up to ' || (4096 + (domain_data.id % 8192)) || ' tokens. Memory usage decreases by ' || (45 + (domain_data.id % 35)) || '%.'
    WHEN 8 THEN 'We develop a ' || LOWER(approach_word) || ' CNN for ' || LOWER(metric_word) || ' in medical image analysis. Our architecture incorporates encoder-decoder skip connections and dilated convolutions for multi-scale feature fusion. On ISIC, ChestX-ray14, and BraTS datasets, we achieve Dice coefficient of ' || (85 + (domain_data.id % 14)) || '% and AUC of ' || (92 + (domain_data.id % 8)) || '%. The model generalizes across modalities including dermoscopy, radiography, and MRI.'
    WHEN 9 THEN 'We introduce a ' || LOWER(approach_word) || ' approach to natural language inference for ' || LOWER(metric_word) || '. Our model uses cross-attention between premise and hypothesis with linguistic features including dependency parses and semantic roles. On SNLI and MultiNLI, we achieve ' || (89 + (domain_data.id % 11)) || '% accuracy. Error analysis shows improved handling of negation and quantifier scope ambiguities.'
    WHEN 10 THEN 'This paper presents ' || LOWER(approach_word) || ' knowledge graph embedding for ' || LOWER(metric_word) || ' in relational reasoning. We learn vector representations of entities and relations using rotational composition. On FB15k-237 and WN18RR, our method achieves MRR of ' || (35 + (domain_data.id % 20)) || '.' || (domain_data.id % 10) || ' and Hits@10 of ' || (55 + (domain_data.id % 25)) || '%. Link prediction results are competitive with TransE and RotatE baselines.'
    WHEN 11 THEN 'We propose a ' || LOWER(approach_word) || ' multi-modal representation learning framework for ' || LOWER(metric_word) || '. Our approach aligns visual and textual embeddings through contrastive learning with a shared latent space. On VQA v2, NLVR2, and SNLI-VE, we achieve ' || (72 + (domain_data.id % 20)) || '% accuracy. Cross-modal retrieval improves Recall@1 by ' || (8 + (domain_data.id % 15)) || '% over baselines.'
    WHEN 12 THEN 'This work introduces a ' || LOWER(approach_word) || ' meta-learning algorithm for few-shot ' || LOWER(metric_word) || '. We learn initialization parameters that adapt with ' || (1 + (domain_data.id % 10)) || '-shot examples. On miniImageNet and tieredImageNet, 5-way 5-shot classification achieves ' || (65 + (domain_data.id % 20)) || '% accuracy. Inner loop adaptation with ' || (1 + (domain_data.id % 5)) || ' gradient steps provides fast convergence.'
    WHEN 13 THEN 'We present a ' || LOWER(approach_word) || ' self-supervised learning method for ' || LOWER(metric_word) || ' in visual recognition. Our pretext task combines contrastive learning with masked image modeling. Pre-trained features transferred to ImageNet linear evaluation achieve ' || (70 + (domain_data.id % 25)) || '% top-1 accuracy. Semi-supervised learning with ' || (1 + (domain_data.id % 10)) || '% labels reaches ' || (80 + (domain_data.id % 15)) || '% accuracy.'
    WHEN 14 THEN 'This paper introduces a ' || LOWER(approach_word) || ' diffusion model for ' || LOWER(metric_word) || ' in generative modeling. We propose a noise schedule with learned variance and classifier-free guidance. On CIFAR-10 and CelebA-HQ, FID scores of ' || (3 + (domain_data.id % 15)) || '.' || (domain_data.id % 10) || ' and ' || (5 + (domain_data.id % 20)) || '.' || (domain_data.id % 10) || ' are achieved. Sampling requires ' || (10 + (domain_data.id % 50)) || ' denoising steps with DDIM acceleration.'
    WHEN 15 THEN 'We investigate ' || LOWER(approach_word) || ' quantum machine learning for ' || LOWER(metric_word) || '. Our quantum kernel method maps classical data to quantum Hilbert space via parameterized circuits. On simulated quantum hardware with ' || (4 + (domain_data.id % 28)) || ' qubits, classification achieves ' || (78 + (domain_data.id % 22)) || '% accuracy. Quantum advantage is observed for specific structured datasets with exponential feature dimensionality.'
    WHEN 16 THEN 'This paper presents an ' || LOWER(approach_word) || ' edge computing framework for ' || LOWER(metric_word) || ' in distributed systems. We design a tiered computation offloading strategy with ' || (2 + (domain_data.id % 8)) || '-level hierarchy. Latency is reduced by ' || (35 + (domain_data.id % 45)) || '% and energy consumption by ' || (20 + (domain_data.id % 40)) || '% compared to cloud-only processing. Experiments use Raspberry Pi clusters with 5G connectivity.'
    WHEN 17 THEN 'We propose a ' || LOWER(approach_word) || ' blockchain consensus mechanism for ' || LOWER(metric_word) || ' in decentralized networks. Our protocol combines practical Byzantine fault tolerance with verifiable random functions. Throughput of ' || (1000 + (domain_data.id % 4000)) || ' TPS is achieved with ' || (50 + (domain_data.id % 200)) || ' validator nodes. Finality latency of ' || (1 + (domain_data.id % 5)) || '.' || (domain_data.id % 10) || ' seconds is demonstrated under adversarial conditions.'
    WHEN 18 THEN 'This paper addresses ' || LOWER(approach_word) || ' cybersecurity frameworks for ' || LOWER(metric_word) || ' in network defense. We propose a zero-trust architecture with continuous authentication and micro-segmentation. Intrusion detection achieves ' || (94 + (domain_data.id % 6)) || '% true positive rate with ' || (0.5 + (domain_data.id % 5)) || '% false positive rate. The framework is evaluated against CICIDS2017 and UNSW-NB15 datasets.'
    WHEN 19 THEN 'We develop an ' || LOWER(approach_word) || ' IoT architecture for ' || LOWER(metric_word) || ' in smart infrastructure. Our system integrates MQTT messaging, edge analytics, and federated model updates. Deployment with ' || (500 + (domain_data.id % 5000)) || ' sensors achieves ' || (99 + (domain_data.id % 1)) || '.' || (domain_data.id % 9) || '% data reliability with ' || (50 + (domain_data.id % 200)) || 'ms average latency. Energy consumption per node is ' || (5 + (domain_data.id % 20)) || 'mW in sleep mode.'
    WHEN 20 THEN 'This paper presents ' || LOWER(approach_word) || ' robotics control for ' || LOWER(metric_word) || ' in autonomous navigation. Our approach combines model predictive control with learned dynamics models. On CARLA and real-world driving tests, ' || (95 + (domain_data.id % 5)) || '% route completion is achieved with zero collisions. Lateral control error is ' || (5 + (domain_data.id % 20)) || 'cm at speeds up to ' || (30 + (domain_data.id % 60)) || ' km/h.'
    WHEN 21 THEN 'We present ' || LOWER(approach_word) || ' climate modeling for ' || LOWER(metric_word) || ' in environmental prediction. Our model couples atmospheric dynamics with ocean circulation using neural surrogate emulators. Temperature prediction RMSE is ' || (0.5 + (domain_data.id % 5)) || '.' || (domain_data.id % 10) || ' degrees C for ' || (3 + (domain_data.id % 10)) || '-day forecasts. The surrogate accelerates simulation by ' || (100 + (domain_data.id % 900)) || 'x over numerical weather prediction baselines.'
    WHEN 22 THEN 'This study introduces ' || LOWER(approach_word) || ' bioinformatics methods for ' || LOWER(metric_word) || ' in genomic analysis. We design a deep learning model for variant calling from sequencing reads. On GIAB benchmark datasets, F1 score of ' || (96 + (domain_data.id % 4)) || '% is achieved for SNV detection. Processing ' || (30 + (domain_data.id % 70)) || 'x whole-genome data takes ' || (1 + (domain_data.id % 5)) || ' hours on a single GPU.'
    WHEN 23 THEN 'We propose ' || LOWER(approach_word) || ' renewable energy optimization for ' || LOWER(metric_word) || ' in power systems. Our approach uses deep reinforcement learning for real-time dispatch of solar and wind generation. Grid integration with ' || (10 + (domain_data.id % 90)) || '% renewable penetration maintains frequency stability within ' || (0.05 + (domain_data.id % 5)) || ' Hz. Curtailed energy is reduced by ' || (15 + (domain_data.id % 40)) || '% over rule-based methods.'
    ELSE 'We present ' || LOWER(approach_word) || ' human-computer interaction research for ' || LOWER(metric_word) || ' in interface design. Our user study with ' || (20 + (domain_data.id % 180)) || ' participants evaluates gaze-adaptive interfaces. Task completion time decreases by ' || (15 + (domain_data.id % 35)) || '% and NASA-TLX workload score by ' || (20 + (domain_data.id % 30)) || '%. SUS usability score of ' || (75 + (domain_data.id % 20)) || '.' || (domain_data.id % 10) || ' is achieved.'
  END,
  -- DOI (about 70% of papers have DOIs)
  CASE WHEN (domain_data.id % 10) < 7
    THEN '10.' || lpad(((domain_data.id * 13) % 9999)::text, 4, '0') || '/resflow-' || domain_data.id::text
    ELSE NULL
  END,
  -- source_id
  'resflow-' || domain_data.id::text,
  -- source_provider
  CASE (domain_data.id % 4)
    WHEN 0 THEN 'openalex'
    WHEN 1 THEN 'crossref'
    WHEN 2 THEN 'arxiv'
    ELSE 'semantic_scholar'
  END,
  -- publication_year (1995-2025, weighted toward recent years)
  1995 + ((domain_data.id * 7 + 13) % 31),
  -- publication_type
  CASE (domain_data.id % 8)
    WHEN 0 THEN 'proceedings-article'
    WHEN 1 THEN 'review'
    WHEN 2 THEN 'book-chapter'
    WHEN 3 THEN 'preprint'
    WHEN 4 THEN 'proceedings-article'
    ELSE 'article'
  END,
  -- is_open_access (~55% true)
  (domain_data.id % 9) < 5,
  -- open_access_url
  CASE WHEN (domain_data.id % 9) < 5
    THEN 'https://openaccess.example.com/resflow-' || domain_data.id::text
    ELSE NULL
  END,
  -- venue: domain-specific journals and conferences
  CASE domain_data.domain_idx
    WHEN 0 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'CVPR' WHEN 1 THEN 'ICCV' ELSE 'ECCV' END
    WHEN 1 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'ACL' WHEN 1 THEN 'EMNLP' ELSE 'NAACL' END
    WHEN 2 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'NeurIPS' WHEN 1 THEN 'ICML' ELSE 'ICLR' END
    WHEN 3 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'KDD' WHEN 1 THEN 'ICDM' ELSE 'SDM' END
    WHEN 4 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'IEEE Transactions on Information Forensics and Security' WHEN 1 THEN 'CCS' ELSE 'PETS' END
    WHEN 5 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'AAAI' WHEN 1 THEN 'IJCAI' ELSE 'AISTATS' END
    WHEN 6 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'NeurIPS' WHEN 1 THEN 'ICLR' ELSE 'CVPR' END
    WHEN 7 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'ICLR' WHEN 1 THEN 'NeurIPS' ELSE 'ACL' END
    WHEN 8 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'MICCAI' WHEN 1 THEN 'IEEE Transactions on Medical Imaging' ELSE 'Medical Image Analysis' END
    WHEN 9 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'EMNLP' WHEN 1 THEN 'ACL' ELSE 'COLING' END
    WHEN 10 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'WWW' WHEN 1 THEN 'ISWC' ELSE 'AAAI' END
    WHEN 11 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'CVPR' WHEN 1 THEN 'ICCV' ELSE 'NeurIPS' END
    WHEN 12 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'ICLR' WHEN 1 THEN 'NeurIPS' ELSE 'ICML' END
    WHEN 13 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'CVPR' WHEN 1 THEN 'NeurIPS' ELSE 'ICLR' END
    WHEN 14 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'NeurIPS' WHEN 1 THEN 'ICML' ELSE 'ICLR' END
    WHEN 15 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'Quantum Machine Intelligence' WHEN 1 THEN 'Physical Review A' ELSE 'npj Quantum Information' END
    WHEN 16 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'IEEE Transactions on Mobile Computing' WHEN 1 THEN 'SEC' ELSE 'IEEE Edge' END
    WHEN 17 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'IEEE Transactions on Blockchain' WHEN 1 THEN 'AFT' ELSE 'Financial Cryptography' END
    WHEN 18 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'IEEE Security & Privacy' WHEN 1 THEN 'CCS' ELSE 'USENIX Security' END
    WHEN 19 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'IEEE Internet of Things Journal' WHEN 1 THEN 'IoTDI' ELSE 'ACM TOSN' END
    WHEN 20 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'IEEE Transactions on Robotics' WHEN 1 THEN 'ICRA' ELSE 'IROS' END
    WHEN 21 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'Nature Climate Change' WHEN 1 THEN 'Journal of Climate' ELSE 'Geophysical Research Letters' END
    WHEN 22 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'Bioinformatics' WHEN 1 THEN 'Nature Methods' ELSE 'Genome Research' END
    WHEN 23 THEN CASE (domain_data.id % 3) WHEN 0 THEN 'Applied Energy' WHEN 1 THEN 'IEEE Transactions on Smart Grid' ELSE 'Renewable Energy' END
    ELSE CASE (domain_data.id % 3) WHEN 0 THEN 'CHI' WHEN 1 THEN 'UIST' ELSE 'IEEE Transactions on Human-Machine Systems' END
  END,
  -- citation_count: varied with some highly-cited papers
  CASE
    WHEN domain_data.id % 50 = 0 THEN (500 + (domain_data.id % 5000))  -- 2% highly cited
    WHEN domain_data.id % 10 = 0 THEN (100 + (domain_data.id % 500))   -- 10% well-cited
    WHEN domain_data.id % 3 = 0 THEN (20 + (domain_data.id % 100))     -- 33% moderately cited
    ELSE (domain_data.id % 25)                                          -- rest: low citations
  END,
  -- concepts: domain-specific
  CASE domain_data.domain_idx
    WHEN 0 THEN ARRAY['Computer Vision', 'Deep Learning', 'Image Classification', 'Object Detection', 'CNN']
    WHEN 1 THEN ARRAY['Natural Language Processing', 'Transformer', 'Language Model', 'Text Classification', 'BERT']
    WHEN 2 THEN ARRAY['Reinforcement Learning', 'Policy Optimization', 'Decision Making', 'Markov Decision Process', 'RL']
    WHEN 3 THEN ARRAY['Graph Neural Networks', 'Node Classification', 'Link Prediction', 'Graph Mining', 'GNN']
    WHEN 4 THEN ARRAY['Federated Learning', 'Privacy', 'Differential Privacy', 'Distributed Training', 'Data Heterogeneity']
    WHEN 5 THEN ARRAY['Transfer Learning', 'Domain Adaptation', 'Multi-Task Learning', 'Representation Transfer', 'ML']
    WHEN 6 THEN ARRAY['Generative Adversarial Networks', 'Image Generation', 'GAN', 'Adversarial Training', 'Synthetic Data']
    WHEN 7 THEN ARRAY['Attention Mechanism', 'Transformer', 'Sequence Modeling', 'Self-Attention', 'Sparse Attention']
    WHEN 8 THEN ARRAY['Medical Imaging', 'CNN', 'Segmentation', 'Diagnosis', 'Healthcare AI']
    WHEN 9 THEN ARRAY['Natural Language Inference', 'Text Understanding', 'NLI', 'Semantic Similarity', 'NLP']
    WHEN 10 THEN ARRAY['Knowledge Graph', 'Graph Embedding', 'Link Prediction', 'Relational Learning', 'Reasoning']
    WHEN 11 THEN ARRAY['Multi-Modal Learning', 'Vision-Language', 'Contrastive Learning', 'Cross-Modal', 'Representation']
    WHEN 12 THEN ARRAY['Meta-Learning', 'Few-Shot Learning', 'Task Adaptation', 'MAML', 'Learning to Learn']
    WHEN 13 THEN ARRAY['Self-Supervised Learning', 'Contrastive Learning', 'Pretext Tasks', 'Visual Representation', 'SSL']
    WHEN 14 THEN ARRAY['Diffusion Models', 'Generative AI', 'Denoising', 'Score Matching', 'Image Synthesis']
    WHEN 15 THEN ARRAY['Quantum Machine Learning', 'Quantum Computing', 'Quantum Kernels', 'Quantum Circuits', 'QML']
    WHEN 16 THEN ARRAY['Edge Computing', 'Distributed Systems', 'Computation Offloading', 'Mobile Computing', 'Edge AI']
    WHEN 17 THEN ARRAY['Blockchain', 'Consensus Mechanism', 'Distributed Ledger', 'Smart Contracts', 'Decentralization']
    WHEN 18 THEN ARRAY['Cybersecurity', 'Intrusion Detection', 'Zero Trust', 'Network Security', 'Threat Detection']
    WHEN 19 THEN ARRAY['IoT', 'Smart Infrastructure', 'Edge Analytics', 'Sensor Networks', 'Connected Devices']
    WHEN 20 THEN ARRAY['Robotics', 'Autonomous Navigation', 'Path Planning', 'Control Systems', 'Autonomous Vehicles']
    WHEN 21 THEN ARRAY['Climate Modeling', 'Environmental Prediction', 'Weather Forecasting', 'Climate Change', 'Atmospheric Science']
    WHEN 22 THEN ARRAY['Bioinformatics', 'Genomic Analysis', 'Variant Calling', 'Sequencing', 'Computational Biology']
    WHEN 23 THEN ARRAY['Renewable Energy', 'Smart Grid', 'Power Systems', 'Energy Optimization', 'Sustainability']
    ELSE ARRAY['Human-Computer Interaction', 'User Interface', 'Usability', 'UX Design', 'Adaptive Interfaces']
  END
FROM domain_data;
