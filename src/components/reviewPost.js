import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function ReviewPost() {
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState("");
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);

  const handleSearch = () => {
    alert(`「${restaurant}」を検索しました`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    alert(`投稿内容\n店名: ${restaurant}\nコメント: ${comment}\n評価: ${rating}点`);
    navigate("/home"); // 投稿後ホーム画面にリダイレクト
  };

  const handleBack = () => {
    navigate(-1); // 1つ前の画面に戻る
  };

  return (
    <div>
      <h1>レビュー投稿画面</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <input
            type="text"
            placeholder="飲食店名を入力"
            value={restaurant}
            onChange={(e) => setRestaurant(e.target.value)}
          />
          <button type="button" onClick={handleSearch}>検索</button>
        </div>
        <div>
          <textarea
            placeholder="コメントを入力"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            cols={40}
          />
        </div>
        <div>
          <span>評価：</span>
          {[1,2,3,4,5].map((num) => (
            <label key={num}>
              <input
                type="radio"
                name="rating"
                value={num}
                checked={rating === num}
                onChange={() => setRating(num)}
              />
              {num}★
            </label>
          ))}
        </div>
        <button type="submit">投稿</button>
      </form>
      <button onClick={handleBack}>戻る</button>
    </div>
  );
}

export default ReviewPost;