import https from 'https';

const urls = [
  'https://storage.googleapis.com/aistudio-user-content/0b094602-5819-4828-9d58-b633909796bf/image.png',
  'https://storage.googleapis.com/aistudio-user-content/0b094602-5819-4828-9d58-b633909796bf/image_1.png',
  'https://storage.googleapis.com/aistudio-user-content/0b094602-5819-4828-9d58-b633909796bf/image_2.png',
  'https://storage.googleapis.com/aistudio-user-content/0b094602-5819-4828-9d58-b633909796bf/image_3.png',
  'https://storage.googleapis.com/aistudio-user-content/0b094602-5819-4828-9d58-b633909796bf/image_4.png',
  'https://storage.googleapis.com/aistudio-user-content/0b094602-5819-4828-9d58-b633909796bf/image_5.png',
  'https://storage.googleapis.com/aistudio-user-content/0b094602-5819-4828-9d58-b633909796bf/image_6.png',
  'https://storage.googleapis.com/aistudio-user-content/0b094602-5819-4828-9d58-b633909796bf/image_7.png',
];

urls.forEach(url => {
  https.get(url, (res) => {
    console.log(url, res.statusCode, res.headers['content-length']);
  });
});
