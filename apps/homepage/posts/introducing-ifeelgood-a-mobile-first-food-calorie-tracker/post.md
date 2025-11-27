# Introducing IFeelGood: A Mobile-First Food & Calorie Tracker

**text:** In today's fast-paced world, maintaining a healthy lifestyle can be challenging. With the rise of mobile technology, there's a growing demand for apps that simplify health management. Enter **IFeelGood**, a minimal, mobile-first food tracking app designed to make calorie tracking as effortless as snapping a photo. Built with Next.js and Supabase, IFeelGood aims to provide a seamless user experience with a focus on simplicity and efficiency.

## What is IFeelGood?

**text:** IFeelGood is a mobile-first application that allows users to track their food intake and calories with minimal effort. The app leverages AI-powered calorie estimation, enabling users to log their meals by simply taking a photo. This approach eliminates the need for manual entry, making it easier for users to maintain their dietary goals.

### Core Philosophy

- **SEXY**: A beautiful, modern UI that feels premium.
- **MINIMAL**: Zero friction, maximum impact.
- **MOBILE-FIRST**: Optimized for phone usage, with a desktop view that mirrors the mobile experience.
- **FEW STEPS**: Quick and easy food logging.
- **SMART**: AI-powered calorie estimation (coming soon).

## Technical Implementation

**text:** IFeelGood is built using a modern tech stack that includes Next.js for the frontend and Supabase for backend services. The app is designed to be highly responsive, ensuring a smooth user experience across different devices.

### Key Features

- **Authentication**: Seamless login/signup with Supabase Auth, ensuring secure session management across the app.
- **Food Logging**: Users can log their meals by taking a photo, with AI handling the calorie estimation.
- **Real-Time Updates**: The app uses SWR for data fetching, providing real-time updates and caching for improved performance.

### Code Example

**code:** Below is a snippet demonstrating how the app handles food photo capture and analysis:

```typescript
import { useState, useRef, useEffect } from "react";
import { Camera } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { User } from "@supabase/supabase-js";
import Image from "next/image";
import { uploadFoodImage } from "@/lib/storage";

export function FoodPhotoCapture({ onSuccess }) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const fileInputRef = useRef(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
      }
    };
    getUser();
  }, [supabase, router]);

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      setCapturedImage(URL.createObjectURL(file));
      setIsCapturing(true);
      // Further processing and analysis logic here
    }
  };

  return (
    <div className="container">
      <button onClick={handleCapture} className="capture-button">
        <Camera className="icon" />
        Take Photo
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />
      {capturedImage && (
        <Image src={capturedImage} alt="Captured food" className="preview" />
      )}
    </div>
  );
}
```

## Installation and Usage

**text:** To get started with IFeelGood, clone the repository and install the dependencies:

```bash
git clone https://github.com/thomasdavis/ifeelgood.git
cd ifeelgood
npm install
```

Run the development server:

```bash
npm run dev
```

Visit `http://localhost:3000` to view the app in your browser.

## Architecture Decisions

**text:** The decision to use Next.js was driven by its ability to handle server-side rendering and static site generation, which are crucial for performance and SEO. Supabase was chosen for its real-time capabilities and ease of integration with authentication and database services.

## Recent Improvements

**text:** Recent updates to IFeelGood include enhancements to the food logging feature, allowing users to edit notes associated with their entries. The app now also supports real-time updates using SWR, ensuring that users always have the most current data.

## Future Roadmap

**text:** Future plans for IFeelGood include integrating more advanced AI features for calorie estimation and expanding the app's capabilities to include exercise tracking and personalized health insights.

## Conclusion

**text:** IFeelGood is a powerful tool for anyone looking to simplify their food tracking process. With its mobile-first design and AI-powered features, it offers a modern solution to an age-old problem. Whether you're a health enthusiast or just starting your wellness journey, IFeelGood is designed to make tracking your nutrition as easy as taking a photo.

For more information, visit the [GitHub repository](https://github.com/thomasdavis/ifeelgood) and explore the [live demo](https://ifeelgood.vercel.app).