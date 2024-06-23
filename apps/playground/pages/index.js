const tf = require('@tensorflow/tfjs');
import { useState } from 'react';

export default function Talk() {
  const [modelReady, setModelReady] = useState(false);
  const [fullModel, setFullModel] = useState(null);
  const [training, setTraining] = useState(false);
  const [chat, setChat] = useState('');

  // Training data: array of sentences
  const sentences = [
    'The quick brown fox jumps over the lazy dog',
    'I love programming in JavaScript',
    'TensorFlow.js makes machine learning in JavaScript easy',
    'Artificial Intelligence is the future',
  ];

  // Preprocessing function to convert sentences to sequences of numbers
  const preprocess = (sentences) => {
    // Create a vocabulary from the sentences
    const words = sentences.join(' ').split(' ');
    const vocabulary = Array.from(new Set(words));

    // Create a word to index mapping
    const wordIndex = {};
    vocabulary.forEach((word, index) => {
      wordIndex[word] = index + 1; // Indexing starts from 1
    });

    // Convert sentences to sequences of numbers
    const sequences = sentences.map((sentence) => {
      return sentence.split(' ').map((word) => wordIndex[word]);
    });

    return { sequences, wordIndex, vocabulary };
  };

  // Preprocess the sentences
  const { sequences, wordIndex, vocabulary } = preprocess(sentences);

  // Parameters
  const vocabSize = vocabulary.length + 1; // +1 for padding
  const embeddingDim = 8; // Dimension of the embedding space
  const maxSeqLength = Math.max(...sequences.map((seq) => seq.length));

  // Pad sequences to the same length
  const padSequences = (sequences, maxLen) => {
    return sequences.map((seq) => {
      const padded = Array(maxLen).fill(0);
      for (let i = 0; i < seq.length; i++) {
        padded[i] = seq[i];
      }
      return padded;
    });
  };

  // Pad sequences
  const paddedSequences = padSequences(sequences, maxSeqLength);

  // Prepare the input data
  const inputs = tf.tensor2d(paddedSequences, [
    paddedSequences.length,
    maxSeqLength,
  ]);

  // Create labels by shifting sequences to the left and padding the end with zeros
  const shiftedSequences = paddedSequences.map((seq) =>
    seq.slice(1).concat([0])
  );

  // One-hot encode the labels
  const oneHotEncode = (sequences, vocabSize) => {
    return sequences.map((seq) => {
      return seq.map((index) => {
        const oneHot = Array(vocabSize).fill(0);
        if (index > 0) {
          oneHot[index] = 1;
        }
        return oneHot;
      });
    });
  };

  const oneHotLabels = oneHotEncode(shiftedSequences, vocabSize);

  // Convert the one-hot encoded labels to a 3D tensor
  const labels = tf.tensor3d(oneHotLabels, [
    paddedSequences.length,
    maxSeqLength,
    vocabSize,
  ]);

  // Define the model
  const model = tf.sequential();
  model.add(
    tf.layers.embedding({
      inputDim: vocabSize,
      outputDim: embeddingDim,
      inputLength: maxSeqLength,
    })
  );
  model.add(tf.layers.lstm({ units: 32, returnSequences: true }));
  model.add(tf.layers.dense({ units: vocabSize, activation: 'softmax' }));

  // Compile the model
  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  // Train the model
  function train() {
    setTraining(true);
    setFullModel(null);
    model.fit(inputs, labels, {
      epochs: 500,
      batchSize: 1,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`Epoch ${epoch + 1}: loss = ${logs.loss}`);
        },
      },
    });
    setFullModel(model);
    setTraining(false);
  }

  function predict(testSentence) {
    // Model training complete

    // Test the model with a new sentence
    const testSequence = testSentence
      .split(' ')
      .map((word) => wordIndex[word])
      .filter(Boolean);
    const paddedTestSequence = padSequences([testSequence], maxSeqLength)[0];
    const testInput = tf.tensor2d([paddedTestSequence], [1, maxSeqLength]);
    console.log({ testSequence, paddedTestSequence, testInput });
    // Predict the next word
    const prediction = fullModel.predict(testInput);
    const predictedIndex = prediction.argMax(-1).dataSync()[0];

    // Find the word corresponding to the predicted index
    const predictedWord = Object.keys(wordIndex).find(
      (key) => wordIndex[key] === predictedIndex
    );
    console.log(`Predicted next word: ${predictedWord}`);
  }

  return (
    <div>
      AI TalkM
      <button onClick={train} disabled={training}>
        Train
      </button>
      <input
        type="text"
        value={chat}
        onChange={(e) => setChat(e.target.value)}
      />
      <button
        disabled={!fullModel || training}
        onClick={() => {
          predict(chat);
        }}
      >
        asdas
      </button>
    </div>
  );
}
