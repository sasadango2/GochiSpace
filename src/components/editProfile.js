import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const CATEGORIES = [
  "中華", "イタリアン", "和食", "スイーツ", "カレー", "ピザ", "ラーメン", "ハンバーガー",
  "丼", "定食", "寿司", "韓国料理", "焼肉", "パン", "エスニック料理"
];

function EditProfile() {
  const [username, setUsername] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [icon, setIcon] = useState(null);
  const navigate = useNavigate();

  const handleCategoryChange = (category) => {
    if (selectedCategories.includes(category)) {
      setSelectedCategories(selectedCategories.filter((c) => c !== category));
    } else if (selectedCategories.length < 3) {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  const handleIconChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setIcon(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedCategories.length !== 3) {
      alert("嗜好は3つ選択してください。");
      return;
    }
    alert(`ユーザーネーム: ${username}\n嗜好: ${selectedCategories.join(", ")}`);
    navigate("/home");
  };

  return (
    <div>
      <h1>プロフィール編集</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>ユーザーネーム：</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <label>嗜好設定（3つ選択）：</label>
          <div style={{ display: "flex", flexWrap: "wrap" }}>
            {CATEGORIES.map((cat) => (
              <label key={cat} style={{ marginRight: 10 }}>
                <input
                  type="checkbox"
                  value={cat}
                  checked={selectedCategories.includes(cat)}
                  onChange={() => handleCategoryChange(cat)}
                  disabled={
                    !selectedCategories.includes(cat) && selectedCategories.length >= 3
                  }
                />
                {cat}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label>アイコン画像：</label>
          <input type="file" accept="image/*" onChange={handleIconChange} />
          {icon && (
            <div>
              <img src={icon} alt="icon" style={{ width: 80, height: 80, borderRadius: "50%" }} />
            </div>
          )}
        </div>
        <button type="submit">保存</button>
      </form>
    </div>
  );
}

export default EditProfile;