# -*- coding: utf-8 -*-
"""
大会シミュレーション（最新版）

◆ 反映済みの要件
- 参加者到着時に 3 枚ドロー（1 人につき 1 回限り）
- テイク条件：手札 2 枚以上
- 手札をテイクした際、重ねたカード数 n を保持し
  • 最上段カードは 60 分後に回収され 1 位プレイヤーが獲得
  • 下に重ねた n-1 枚は山札に戻す
- リミット解除：投稿が参加者数に達するか、120 分無投稿
- カウントダウン：60 分固定（延長なし）
- ミニゲーム所要時間：平均 15 分（正規分布 μ=15, σ≈5、下限 2）
- 投稿失敗確率：難易度 × 5 %
- 指標出力：場札枚数推移 / 山札残量推移 / 投稿総数 / 回収総数
"""

import random
import numpy as np
import matplotlib.pyplot as plt
from collections import deque

# -----------------------------
# シミュレーション定数
# -----------------------------
TOTAL_MINUTES = 24 * 60  # 大会時間 24h
DECK_SIZE = 150  # 初期山札枚数
INIT_HAND = 3  # 参加時ドロー枚数
REQUIRED_HAND_TAKE = 3  # テイク条件（手札枚数）
NO_POST_TIMEOUT = 120  # 無投稿でリミット解除（分）
CD_INITIAL = 90  # カウントダウン（分）
DRAW_PT_THRESHOLD = 3  # ドローポイント発動閾値
SEED = 42  # 乱数シード（再現用）

random.seed(SEED)
np.random.seed(SEED)


# -----------------------------
# 参加者到着・離脱モデル
# -----------------------------
def gen_arrivals(n_players=15):
    """半数は開始時到着、残りは指数分布でランダム到着"""
    early = n_players // 2
    arrivals = [0] * early
    lam = 1 / 240  # 平均 4h で到着
    while len(arrivals) < n_players:
        t = int(np.random.exponential(1 / lam))
        if t < TOTAL_MINUTES:
            arrivals.append(t)
    return sorted(arrivals)


def gen_leave(arrival):
    """6h 滞在後、指数分布で離脱。50% は最後まで在室"""
    must = 360
    if random.random() < 0.5:
        return TOTAL_MINUTES
    extra = int(np.random.exponential(300))
    return min(TOTAL_MINUTES, arrival + must + extra)


# -----------------------------
# データ構造
# -----------------------------
class Card:
    def __init__(self, now, stack_size):
        self.stack_size = stack_size  # 重ねた枚数 n
        self.difficulty = random.randint(1, 5)  # 1～5
        self.post_cnt = 0
        self.limit_open = False
        self.cd = None
        self.last_post = now
        self.scores = {}  # {pid:score}

    def post(self, pid, now):
        """スコア投稿"""
        score = max(0, random.gauss(100 - 10 * self.difficulty, 10))
        self.scores[pid] = score
        self.post_cnt += 1
        self.last_post = now

    def tick(self):
        """1 分経過処理"""
        if self.limit_open and self.cd is not None:
            self.cd -= 1


class Player:
    def __init__(self, pid, arrive, leave):
        self.pid = pid
        self.arrive = arrive
        self.leave = leave
        self.hand = 0
        self.draw_pt = 0
        self.busy = 0  # プレイ中残り分
        self.joined = False

    def available(self, t):
        return self.joined and self.arrive <= t < self.leave and self.busy == 0


# -----------------------------
# メインシミュレーション
# -----------------------------
def run_sim(n_players=15):
    deck = deque([None] * DECK_SIZE)  # None で枚数のみ管理
    table = []
    posts = 0
    recov = 0

    arrivals = gen_arrivals(n_players)
    leaves = [gen_leave(a) for a in arrivals]
    players = [Player(i, a, l) for i, (a, l) in enumerate(zip(arrivals, leaves))]

    hist_table, hist_deck = [], []

    # ---- 1 分刻みループ ----
    for minute in range(TOTAL_MINUTES):

        # 新規参加者：3 枚ドロー
        for p in players:
            if not p.joined and p.arrive == minute:
                draw = min(INIT_HAND, len(deck))
                for _ in range(draw):
                    deck.popleft()
                    p.hand += 1
                p.joined = True

        # 行動フェーズ
        random.shuffle(players)
        for p in players:
            if p.busy > 0:
                p.busy -= 1
                continue
            if not p.available(minute):
                continue

            # 1) テイク（優先）
            if p.hand >= REQUIRED_HAND_TAKE:
                n = p.hand
                p.hand = 0
                table.append(Card(minute, n))
                continue

            # 2) 投稿
            if table:
                # 残り CD が短い & 低難易度 優先
                card = min(
                    table,
                    key=lambda c: (
                        (c.cd if c.cd is not None else CD_INITIAL + NO_POST_TIMEOUT),
                        c.difficulty,
                    ),
                )
                # 難易度による断念
                if random.random() < 0.05 * card.difficulty:
                    continue

                # プレイ開始
                p.busy = max(2, int(np.random.normal(15, 5)))
                card.post(p.pid, minute)
                posts += 1

                # リミット解除
                active = [pl for pl in players if pl.available(minute)]
                if not card.limit_open:
                    if card.post_cnt >= len(active):
                        card.limit_open = True
                        card.cd = CD_INITIAL
                    elif minute - card.last_post >= NO_POST_TIMEOUT:
                        card.limit_open = True
                        card.cd = CD_INITIAL
                continue

            # 3) ドロー
            if p.draw_pt >= DRAW_PT_THRESHOLD and deck:
                for _ in range(p.draw_pt):
                    if deck:
                        p.hand += 1
                        deck.popleft()
                p.draw_pt = 0

        # ---- カード進行 ----
        finished = []
        for c in table:
            c.tick()
            if c.limit_open and c.cd is not None and c.cd <= 0:
                finished.append(c)

        for c in finished:
            table.remove(c)
            recov += 1

            n = c.stack_size
            # 下位 n 人にドローポイント付与
            if c.scores:
                bottom = list(reversed(sorted(c.scores.items(), key=lambda kv: kv[1])))[:n]
                for i, (pid, _) in enumerate(bottom):
                    players[pid].draw_pt += n - i  # n, n-1, ...

            # 下に重ねた n-1 枚をデッキへ戻す
            for _ in range(n - 1):
                deck.append(None)

        # ---- ログ ----
        hist_table.append(len(table))
        hist_deck.append(len(deck))

    return hist_table, hist_deck, posts, recov


# -----------------------------
# 実行 & 可視化
# -----------------------------
if __name__ == "__main__":
    table_hist, deck_hist, total_posts, total_recov = run_sim()

    # グラフ：場札数
    plt.figure()
    plt.plot(table_hist)
    plt.title("場札数の推移")
    plt.xlabel("経過時間（分）")
    plt.ylabel("場札枚数")
    plt.tight_layout()

    # グラフ：山札残量
    plt.figure()
    plt.plot(deck_hist)
    plt.title("山札残量の推移")
    plt.xlabel("経過時間（分）")
    plt.ylabel("残り枚数")
    plt.tight_layout()
    plt.show()

    print(f"ミニゲーム投稿総数 : {total_posts}")
    print(f"回収カード総数     : {total_recov}")
