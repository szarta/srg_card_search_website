import { useState } from "react";
import { Link } from "react-router-dom";

export default function SubmitMissingImage() {
  const [cardName, setCardName] = useState("");
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Please select a valid image file");
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError("Image must be smaller than 10MB");
        return;
      }

      setImage(file);
      setError("");

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!cardName.trim()) {
      setError("Card name is required");
      return;
    }

    if (!image) {
      setError("Please select an image");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append("card_name", cardName);
      formData.append("image", image);

      const response = await fetch("/api/submissions/missing-image", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setCardName("");
        setImage(null);
        setPreview("");
      } else {
        setError(data.detail || "Submission failed");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Link to="/" className="text-purple-400 hover:text-purple-300 mb-4 inline-block">
        ← Back to Home
      </Link>

      <h1 className="text-3xl font-bold mb-6">Submit Missing Image</h1>

      <p className="text-gray-300 mb-6">
        Help us complete our card image collection by uploading images for cards that don't have them yet.
      </p>

      {success && (
        <div className="bg-green-900/50 border border-green-500 rounded p-4 mb-6">
          <p className="text-green-200">
            Thank you! Your image has been received and will be reviewed.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded p-4 mb-6">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-neutral-900 p-6 rounded-lg shadow-lg">
        <div className="mb-4">
          <label htmlFor="cardName" className="block text-sm font-medium mb-2">
            Card Name <span className="text-red-400">*</span>
          </label>
          <input
            id="cardName"
            type="text"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3"
            placeholder="Enter card name"
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="image" className="block text-sm font-medium mb-2">
            Card Image <span className="text-red-400">*</span>
          </label>
          <input
            id="image"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="w-full bg-gray-800 text-white border border-gray-700 rounded p-3 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-purple-700 file:text-white hover:file:bg-purple-600"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Accepted formats: JPEG, PNG, WebP (max 10MB)
          </p>
        </div>

        {preview && (
          <div className="mb-6">
            <p className="text-sm font-medium mb-2">Preview:</p>
            <img
              src={preview}
              alt="Preview"
              className="max-w-sm mx-auto rounded border border-gray-700"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-purple-700 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Uploading..." : "Submit Image"}
        </button>
      </form>
    </div>
  );
}
