import json
import pandas as pd
import matplotlib.pyplot as plt
import random
import numpy as np

# Set dark theme
plt.style.use("dark_background")

# Custom color palette
COLORS = {
    "price": "#00FFFF",  # Cyan
    "change": "#FF69B4",  # Hot Pink
    "highlight": "#FFD700",  # Gold
    "grid": "#2A2A2A",  # Dark Gray
    "text": "#FFFFFF",  # White
}

# Load the data
with open("db.json", "r") as f:
    data = json.load(f)

# Convert to DataFrame for easier analysis
all_txs = []
for token in data["tokens"]:
    for tx in token["txs"]:
        tx["token_address"] = token["address"]
        tx["token_name"] = token["info"]["name"]
        tx["token_symbol"] = token["info"]["symbol"]
        all_txs.append(tx)

df = pd.DataFrame(all_txs)
# Convert newPrice to float
df["newPrice"] = df["newPrice"].astype(float)

# Get token trade counts and filter for tokens with mostly trades above 0.1 SOL
token_trade_counts = df.groupby("token_address").size()
token_avg_prices = df.groupby("token_address")["newPrice"].mean()
active_tokens = token_trade_counts[
    (token_trade_counts > 60) & (token_avg_prices > 0.1)
].index.tolist()

if not active_tokens:
    print("No tokens found with more than 60 trades and average price above 0.1 SOL!")
    exit()

# Create a 3x3 grid of subplots
fig, axes = plt.subplots(3, 3, figsize=(20, 15))
fig.suptitle(
    "Token Price Histories (Tokens with >60 trades)", fontsize=16, color=COLORS["text"]
)

# Set figure background color
fig.patch.set_facecolor("#121212")

# Flatten the axes array for easier iteration
axes = axes.flatten()

# Select 9 random tokens
selected_tokens = random.sample(active_tokens, min(9, len(active_tokens)))

for idx, (ax, random_token) in enumerate(zip(axes, selected_tokens)):
    token_name = df[df["token_address"] == random_token]["token_name"].iloc[0]
    token_symbol = df[df["token_address"] == random_token]["token_symbol"].iloc[0]
    trade_count = token_trade_counts[random_token]

    # Filter data for random token
    token_data = df[df["token_address"] == random_token].sort_values("slot")

    # Create twin axes for price and percentage change
    ax2 = ax.twinx()

    # Set subplot background color
    ax.set_facecolor("#1E1E1E")
    ax2.set_facecolor("#1E1E1E")

    # Plot price changes
    ax.plot(
        token_data["slot"],
        token_data["newPrice"].astype(float),
        color=COLORS["price"],
        label="Price",
        linewidth=2,
    )
    ax.set_title(
        f"{token_name} ({token_symbol})\n{trade_count} trades", color=COLORS["text"]
    )
    ax.set_ylabel("Price (SOL)", color=COLORS["text"])
    ax.grid(True, color=COLORS["grid"], alpha=0.3)
    ax.tick_params(axis="y", colors=COLORS["text"])
    ax.tick_params(axis="x", colors=COLORS["text"])

    # Highlight significant changes (>30%) on the price plot with smaller dots
    significant_changes = token_data[
        (abs(token_data["priceChangePercent"]) > 30)
        & (token_data["newPrice"].astype(float) > 0.1)
    ]
    if not significant_changes.empty:
        ax.scatter(
            significant_changes["slot"],
            significant_changes["newPrice"].astype(float),
            color=COLORS["highlight"],
            s=40,  # Smaller dot size
            marker="o",
            label=">30% Change",
            edgecolors="white",
            linewidth=1,
        )

    # Combine legends
    lines1, labels1 = ax.get_legend_handles_labels()
    ax.legend(
        lines1,
        labels1,
        loc="upper left",
        facecolor="#1E1E1E",
        edgecolor="none",
        labelcolor=COLORS["text"],
    )

plt.tight_layout()
plt.show()
