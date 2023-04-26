const format = async function format(resume) {
  return 'unsupported latex';
  //   return `
  // %-------------------------
  // % Resume in Latex
  // % Author : Aras Gungore
  // % License : MIT
  // %------------------------

  // \documentclass[letterpaper,11pt]{article}

  // \usepackage{latexsym}
  // \usepackage[empty]{fullpage}
  // \usepackage{titlesec}
  // \usepackage{marvosym}
  // \usepackage[usenames,dvipsnames]{color}
  // \usepackage{verbatim}
  // \usepackage{enumitem}
  // \usepackage[hidelinks]{hyperref}
  // \usepackage{fancyhdr}
  // \usepackage[english]{babel}
  // \usepackage{tabularx}
  // \usepackage{hyphenat}
  // \usepackage{fontawesome}
  // \input{glyphtounicode}

  // %---------- FONT OPTIONS ----------
  // % sans-serif
  // % \usepackage[sfdefault]{FiraSans}
  // % \usepackage[sfdefault]{roboto}
  // % \usepackage[sfdefault]{noto-sans}
  // % \usepackage[default]{sourcesanspro}

  // % serif
  // % \usepackage{CormorantGaramond}
  // % \usepackage{charter}

  // \pagestyle{fancy}
  // \fancyhf{} % clear all header and footer fields
  // \fancyfoot{}
  // \renewcommand{\headrulewidth}{0pt}
  // \renewcommand{\footrulewidth}{0pt}

  // % Adjust margins
  // \addtolength{\oddsidemargin}{-0.5in}
  // \addtolength{\evensidemargin}{-0.5in}
  // \addtolength{\textwidth}{1in}
  // \addtolength{\topmargin}{-.5in}
  // \addtolength{\textheight}{1.0in}

  // \urlstyle{same}

  // \raggedbottom
  // \raggedright
  // \setlength{\tabcolsep}{0in}

  // % Sections formatting
  // \titleformat{\section}{
  //   \vspace{-4pt}\scshape\raggedright\large
  // }{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

  // % Ensure that generate pdf is machine readable/ATS parsable
  // \pdfgentounicode=1

  // %-------------------------
  // % Custom commands

  // \newcommand{\resumeItem}[1]{
  //   \item\small{
  //     {#1 \vspace{-2pt}}
  //   }
  // }

  // \newcommand{\resumeSubheading}[4]{
  //   \vspace{-2pt}\item
  //     \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
  //       \textbf{#1} & #2 \\
  //       \textit{\small#3} & \textit{\small #4} \\
  //     \end{tabular*}\vspace{-7pt}
  // }

  // \newcommand{\resumeSubSubheading}[2]{
  //     \vspace{-2pt}\item
  //     \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
  //       \textit{\small#1} & \textit{\small #2} \\
  //     \end{tabular*}\vspace{-7pt}
  // }

  // \newcommand{\resumeEducationHeading}[6]{
  //   \vspace{-2pt}\item
  //     \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
  //       \textbf{#1} & #2 \\
  //       \textit{\small#3} & \textit{\small #4} \\
  //       \textit{\small#5} & \textit{\small #6} \\
  //     \end{tabular*}\vspace{-5pt}
  // }

  // \newcommand{\resumeProjectHeading}[2]{
  //     \vspace{-2pt}\item
  //     \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
  //       \small#1 & #2 \\
  //     \end{tabular*}\vspace{-7pt}
  // }

  // \newcommand{\resumeOrganizationHeading}[4]{
  //   \vspace{-2pt}\item
  //     \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
  //       \textbf{#1} & \textit{\small #2} \\
  //       \textit{\small#3}
  //     \end{tabular*}\vspace{-7pt}
  // }

  // \newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

  // \renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

  // \newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
  // \newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
  // \newcommand{\resumeItemListStart}{\begin{itemize}}
  // \newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}

  // %-------------------------------------------
  // %%%%%%  RESUME STARTS HERE  %%%%%%%%%%%%%%%%%%%%%%%%%%%%

  // \begin{document}

  // %---------- HEADING ----------

  // \begin{center}
  //     \textbf{\Huge \scshape Aras Güngöre} \\ \vspace{3pt}
  //     \small
  //     \faMobile \hspace{.5pt} \href{tel:905314204536}{+90 531 420 4536}
  //     $|$
  //     \faAt \hspace{.5pt} \href{mailto:arasgungore09@gmail.com}{arasgungore09@gmail.com}
  //     $|$
  //     \faLinkedinSquare \hspace{.5pt} \href{https://www.linkedin.com/in/arasgungore}{LinkedIn}
  //     $|$
  //     \faGithub \hspace{.5pt} \href{https://github.com/arasgungore}{GitHub}
  //     $|$
  //     \faGlobe \hspace{.5pt} \href{https://arasgungore.github.io}{Portfolio}
  //     $|$
  //     \faMapMarker \hspace{.5pt} \href{https://www.google.com/maps/place/Bogazici+University+North+Campus/@41.0863067,29.0441352,15z/data=!4m5!3m4!1s0x0:0x9d2497b07c8edb2f!8m2!3d41.0863067!4d29.0441352}{Istanbul, Turkey}
  // \end{center}

  // %----------- EDUCATION -----------

  // \section{Education}
  //   \vspace{3pt}
  //   \resumeSubHeadingListStart

  //     \resumeEducationHeading
  //       {Boğaziçi University
  //       % \normalfont{(Admission rate: 0.09\%)}
  //       }{Istanbul, Turkey}
  //       {B.Sc. in Electrical and Electronics Engineering;   \textbf{GPA: 3.73/4.00}}{Sep 2018 \textbf{--} Jun 2023 (Expected)}
  //       {Minor Degree in Computer Engineering;   \textbf{GPA: 3.89/4.00}}{Oct 2020 \textbf{--} Jun 2023 (Expected)}
  //         % \resumeItemListStart
  //             % \resumeItem{\textbf{Relevant coursework:} Calculus I-II, Matrix Theory, Differential Equations, Materials Science, Electrical Circuits I-II, Digital System Design, Numerical Methods, Probability Theory, Electronics I-II, Signals and Systems, Electromagnetic Field Theory, Energy Conversion, System Dynamics and Control, Communication Engineering}
  //         % \resumeItemListEnd

  //     \resumeSubheading
  //       {Kocaeli Science High School
  //       % \normalfont{(Admission rate: 0.85\%)}
  //       }{Kocaeli, Turkey}
  //       {High School Diploma;   \textbf{GPA: 97.03/100}}{Sep 2014 \textbf{--} Jun 2018}

  //   \resumeSubHeadingListEnd

  // %----------- RESEARCH EXPERIENCE -----------

  // \section{Research Experience}
  //   \vspace{3pt}
  //   \resumeSubHeadingListStart

  //     \resumeSubheading
  //       {Max Planck Institute for Intelligent Systems}{Stuttgart, Baden\textbf{-}Württemberg, Germany}
  //       {Undergraduate Research Assistant}{Jun 2022 \textbf{--} Aug 2022}
  //         \resumeItemListStart
  //             \resumeItem{Worked in the Physical Intelligence Department with Sinan Özgün Demir and Alp Can Karacakol on a project about 3D printing and heat-assisted magnetic programming of soft machines.}
  //             \resumeItem{Updated a ROS package for converting 3D motion controller events to ROS messages so that it synchronously operates at any given loop rate.}
  //             \resumeItem{Implemented an Arduino Mega driver for controlling a fluid dispenser, a laser, thermocouples, and a coil set. Updated ROS nodes for parsing G-codes and controlling stage movement and built the ROS-Arduino communication network to simulate a 3D printing and magnetic programming process.}
  //         \resumeItemListEnd

  //     \resumeSubheading
  //       {Nanonetworking Research Group, Boğaziçi University}{Istanbul, Turkey}
  //       {Undergraduate Research Assistant}{Oct 2021 \textbf{--} Present}
  //         \resumeItemListStart
  //             \resumeItem{Currently working with Assoc. Prof. Ali Emre Pusane on the project “Design and Implementation of Molecular Communication Systems Using Index Modulation” under the TÜBİTAK 2247-C Intern Researcher Scholarship Program (STAR).}
  //             \resumeItem{Simulated the Brownian motion of molecules in a SISO MCvD system and predicted simulation parameters such as receiver radius, diffusion coefficient, and transmitter-receiver distance using CNNs with Python.}
  //             \resumeItem{Plotted the arrival of molecules per symbol duration in a SISO MCvD system using Binomial, Poisson, and Gaussian model approximations with MATLAB.}
  //             \resumeItem{Ran Monte Carlo simulations of the Gaussian model to encode/decode randomized binary sequences in a SISO MCvD system using BCSK modulation technique and calculated the bit error rate (BER) on Z-channel.}
  //         \resumeItemListEnd

  //   \resumeSubHeadingListEnd

  // %----------- WORK EXPERIENCE -----------

  // \section{Work Experience}
  //   \vspace{3pt}
  //   \resumeSubHeadingListStart

  //     \resumeSubheading
  //       {SESTEK Speech Enabled Software Technologies}{Istanbul, Turkey}
  //       {Natural Language Processing R\&D Intern}{Jan 2022 \textbf{--} Feb 2022}
  //         \resumeItemListStart
  //             \resumeItem{Implemented common NLP tasks using transformers such as named-entity recognition (NER), part-of-speech (POS) tagging, sentiment analysis, text classification, and extractive/generative question answering.}
  //             \resumeItem{Built a generative question answering system via Dense Passage Retrieval (DPR) and Retrieval-Augmented Generation (RAG) using the Haystack framework with Python.}
  //             \resumeItem{Worked on a custom Turkish open-domain question answering system by fine-tuning a BERT base model transformer. Evaluated the exact match and F1 scores using different Turkish data sets and compared the evaluation results.}
  //         \resumeItemListEnd

  //     % \resumeSubheading
  //       % {Ankara Metropolitan Municipality}{Ankara, Turkey}
  //       % {SCADA Engineering Intern}{Aug 2021 \textbf{--} Sep 2021}
  //         % \resumeItemListStart
  //             % \resumeItem{Designed GSM/GPRS-based electrical control panels that are connected to local water pump automation systems. Pump station panels use digital output data received from the SCADA control center via RF transmission to control valves and pumps. Tank station panels are charged from the PV system and refill water tanks by signaling the pump station panel when the float switch is activated.}
  //             % \resumeItem{Implemented motor control circuits by reading their PLC ladder diagrams and analyzed the EPLAN project documentation, HMI, and hardware components of an RTU panel.}
  //         % \resumeItemListEnd

  //     % \vspace{15pt}
  //     \resumeSubheading
  //       {Meteksan Defense Industry Inc.}{Ankara, Turkey}
  //       {Analog Design Engineering Intern}{Jul 2021 \textbf{--} Aug 2021}
  //         \resumeItemListStart
  //             \resumeItem{Designed numerous analog circuits such as voltage-mode controlled buck converter, phase-shifted full-bridge isolated DC-DC converter, and EMI filters with LTspice. Integrated these circuits and implemented a 320 W power distribution unit to be used in a radar system's power circuit board.}
  //             \resumeItem{Researched real-world compatible electronic components to be used in such circuits including GaNFETs, high-side gate drivers, and Schottky diodes.}
  //             \resumeItem{Assembled PCBs of both common and differential mode filters and used VNA Bode 100 to measure the cut-off frequencies.}
  //         \resumeItemListEnd

  //   \resumeSubHeadingListEnd

  // %----------- AWARDS & ACHIEVEMENTS -----------

  // \section{Awards \& Achievements}
  //   \vspace{2pt}
  //   \resumeSubHeadingListStart
  //     \small{\item{
  //         \textbf{National University Admission Exam (YKS):}{ Ranked $75^{th}$ in Mathematics and Science among ca. 2.3 million candidates with a test score of 489.92/500.} \\ \vspace{3pt}

  //         \textbf{KYK Outstanding Success Scholarship:}{ Awarded to undergraduate students who have been ranked in the top 100 on National University Admission Exam by Higher Education Credit and Hostels Institution (KYK).} \\ \vspace{3pt}

  //         \textbf{Boğaziçi University Success Scholarship:}{ Awarded to undergraduate students who have been ranked in the top 100 on National University Admission Exam by Boğaziçi University.} \\ \vspace{3pt}

  //         \textbf{TÜBİTAK 2247-C Intern Researcher Scholarship:}{ Awarded to undergraduate students who take part in research projects carried out by the Scientific and Technological Research Council of Turkey (TÜBİTAK).} \\ \vspace{3pt}

  //         \textbf{Duolingo English Test (DET):}{ Overall Score: 135/160} \\ \vspace{3pt}

  //         % \textbf{Boğaziçi University English Proficiency Test (BUEPT):}{ Achieved the highest grade A on the BUEPT grading scheme with a total score in the range of 85-100.} \\ \vspace{3pt}

  //         \textbf{Kocaeli Science High School Salutatorian Award:}{ Graduated as the second-highest ranked student in my class.}
  //     }}
  //   \resumeSubHeadingListEnd

  // %----------- PROJECTS -----------

  // \section{Projects}
  //     \vspace{3pt}
  //     \resumeSubHeadingListStart

  //       \resumeProjectHeading
  //         {\textbf{Filters and Fractals} $|$ \emph{\href{https://github.com/arasgungore/filters-and-fractals}{\color{blue}GitHub}}}{}
  //           \resumeItemListStart
  //             \resumeItem{A C project which implements a variety of image processing operations that manipulate the size, filter, brightness, contrast, saturation, and other properties of PPM images from scratch.}
  //             \resumeItem{Added recursive fractal generation functions to model popular fractals including Mandelbrot set, Julia set, Koch curve, Barnsley fern, and Sierpinski triangle in PPM format.}
  //           \resumeItemListEnd

  //       \resumeProjectHeading
  //         {\textbf{Chess Bot} $|$ \emph{\href{https://github.com/arasgungore/chess-bot}{\color{blue}GitHub}}}{}
  //           \resumeItemListStart
  //             \resumeItem{A C++ project in which you can play chess against an AI with a specified decision tree depth that uses alpha-beta pruning algorithm to predict the optimal move.}
  //             \resumeItem{Aside from basic moves, this mini chess engine also implements chess rules such as castling, en passant, fifty-move rule, threefold repetition, and pawn promotion.}
  //           \resumeItemListEnd

  //       \resumeProjectHeading
  //         {\textbf{Rocket Flight Simulator} $|$ \emph{\href{https://github.com/arasgungore/rocket-flight-simulator}{\color{blue}GitHub}}}{}
  //           \resumeItemListStart
  //             \resumeItem{A Simulink project which can accurately simulate the motion of a flying rocket in one-dimensional space.}
  //             \resumeItem{The project implements the forces acting on a rocket which are drag, weight, and thrust as subsystems that take time-variant parameters into consideration such as distance from the center of Earth, mass and velocity of the rocket, and air density at different layers of Earth's atmosphere.}
  //           \resumeItemListEnd

  //       \resumeProjectHeading
  //         {\textbf{Netlist Solver} $|$ \emph{\href{https://github.com/arasgungore/netlist-solver}{\color{blue}GitHub}}}{}
  //           \resumeItemListStart
  //             \resumeItem{A MATLAB project that uses modified nodal analysis (MNA) algorithm to calculate the node voltages of any analog circuit without dependent sources given in netlist format.}
  //             \resumeItem{Added a module that sweeps the resistance of a load resistor, plots power dissipation as a function of load resistance, and finds the resistance value corresponding to maximum power.}
  //           \resumeItemListEnd

  //       \resumeProjectHeading
  //         {\textbf{CMPE 250 Projects} $|$ \emph{\href{https://github.com/arasgungore/CMPE250-projects}{\color{blue}GitHub}}}{}
  //           \resumeItemListStart
  //             \resumeItem{Five Java projects assigned for the Data Structures and Algorithms (CMPE 250) course in the Fall 2021-22 semester.}
  //             \resumeItem{These projects apply DS\&A concepts such as discrete-event simulation (DES) using priority queues, Dijkstra's shortest path algorithm, Prim's algorithm to find the minimum spanning tree (MST), Dinic's algorithm for maximum flow problems, and weighted job scheduling with dynamic programming to real-world problems.}
  //           \resumeItemListEnd

  //     \resumeSubHeadingListEnd

  // %----------- SKILLS -----------

  // \section{Skills}
  //   \vspace{2pt}
  //   \resumeSubHeadingListStart
  //     \small{\item{
  //         \textbf{Programming:}{ C, C++, Java, Python, MATLAB, R, MySQL, VHDL} \\ \vspace{3pt}

  //         \textbf{Technologies:}{ Git, Arduino, ROS, Simulink, LTspice, Xilinx ISE} \\ \vspace{3pt}

  //         \textbf{Languages:}{ Turkish (Native), English (Professional), German (Elementary)}

  //         % \textbf{Frameworks}{: X, X, X} \\
  //         % \textbf{Developer Tools}{: X, X, X} \\
  //         % \textbf{Libraries}{: X, X, X} \\
  //         % \textbf{Applications}{: X, X, X}
  //     }}
  //   \resumeSubHeadingListEnd

  // %----------- RELEVANT COURSEWORK -----------

  // \section{Relevant Coursework}
  //   \vspace{2pt}
  //   \resumeSubHeadingListStart
  //     \small{\item{
  //         \textbf{Major coursework:}{ Calculus I-II, Matrix Theory, Differential Equations, Materials Science, Electrical Circuits I-II, Digital System Design, Numerical Methods, Probability Theory, Electronics I-II, Signals and Systems, Electromagnetic Field Theory, Energy Conversion, System Dynamics and Control, Communication Engineering} \\ \vspace{3pt}

  //         \textbf{Minor coursework:}{ Discrete Computational Structures, Introduction to Object-Oriented Programming, Data Structures and Algorithms}
  //     }}
  //   \resumeSubHeadingListEnd

  // %----------- CERTIFICATES -----------

  // % \section{Certificates}
  //   % \resumeSubHeadingListStart

  //     % \resumeOrganizationHeading
  //       % {Procter \& Gamble VIA Certificate Program}{Feb 2022}{Business Skills, Data and Digital Skills, Project Management and Personal Productivity}

  //   % \resumeSubHeadingListEnd

  // %----------- ORGANIZATIONS -----------

  // % \section{Organizations}
  //   % \resumeSubHeadingListStart

  //     % \resumeOrganizationHeading
  //       % {Institute of Electrical and Electronics Engineers (IEEE)}{Feb 2022 -- Present}{Student Member}

  //   % \resumeSubHeadingListEnd

  // %----------- HOBBIES -----------

  // % \section{Hobbies}
  //   % \resumeSubHeadingListStart
  //     % \small{\item{Swimming, Fitness, Eight-ball}}
  //   % \resumeSubHeadingListEnd

  // %----------- REFERENCES -----------

  // % \section{References}
  //   % \resumeSubHeadingListStart

  //   % \resumeSubHeadingListEnd

  // %-------------------------------------------
  // \end{document}
  // `;
};

export { format };
