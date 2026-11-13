"""Economy model for the New World x Brotato hybrid graph.

Every number here is an ASSUMPTION, not data. The model is for comparing
scenarios (a design node switched on or off) and for seeing which conclusions
survive when the assumptions are shaken, not for predicting real values.

Run:  python3 economy_model.py
"""
import numpy as np

BASE = dict(
    weeks=13, agents=3000,
    cohorts=[("casual", 0.60, 3, 0.65), ("regular", 0.30, 8, 0.78), ("hardcore", 0.10, 20, 0.88)],
    crafter_share=0.15,
    yield0=10.0, yield_g=1.5,      # material value per successful session, growth per gear tier
    coin0=10.0, coin_g=1.3,        # coin per successful session
    cost0=60.0, cost_g=1.8,        # material value to craft a gear tier
    banked_on_fail=0.4,            # share of a session's materials kept on a failed run
    wear_ok=0.02, wear_fail=0.10,  # durability lost per successful / failed session (1.0 = broken)
    repair_mats=0.35,              # repair cost as share of the item's craft cost
    tax=0.075, fee=0.02, margin=0.15,
    uc_per_win=10.0, uc_cap=100.0, uc_need={5: 150.0, 6: 300.0},
    frontload=False,               # True: first 3 wins of the week pay most of the weekly currency
    consumables=0.0,               # share of a session's yield value spent on crafted flasks/oils
    quartermaster=0.0,             # share of that week's sunk coin re-spent buying crafted stock
    max_tier=6,
)

def run(seed=0, **over):
    P = {**BASE, **over}; rng = np.random.default_rng(seed)
    n = P["agents"]
    coh = rng.choice(len(P["cohorts"]), n, p=[c[1] for c in P["cohorts"]])
    sess_mu = np.array([c[2] for c in P["cohorts"]])[coh]
    p_ok = np.array([c[3] for c in P["cohorts"]])[coh]
    crafter = rng.random(n) < P["crafter_share"]
    g = np.ones(n); coin = np.zeros(n); mats = np.zeros(n); dur = np.ones(n); uc = np.zeros(n)
    pm = 1.0; hist = []
    cost = lambda t: P["cost0"] * P["cost_g"] ** (t - 1)
    for w in range(P["weeks"]):
        s = rng.poisson(sess_mu); wins = rng.binomial(s, p_ok); fails = s - wins
        broken = dur <= 0
        eff = np.where(broken, 0.6, 1.0)
        earned = (wins + fails * P["banked_on_fail"]) * P["yield0"] * P["yield_g"] ** (g - 1) * eff
        mats += earned
        faucet = wins * P["coin0"] * P["coin_g"] ** (g - 1) * eff
        coin += faucet
        # capped upgrade currency, earned from tier 4 up
        if P["frontload"]:
            gain = np.minimum(wins, 3) * 30.0 + np.maximum(wins - 3, 0) * 1.0
        else:
            gain = wins * P["uc_per_win"]
        if P["uc_cap"]: gain = np.minimum(gain, P["uc_cap"])
        uc += np.where(g >= 4, gain, 0)
        # wear and repair (materials first, then nothing: gear stays broken)
        dur -= wins * P["wear_ok"] + fails * P["wear_fail"]
        need = (dur <= 0) * P["repair_mats"] * cost(g)
        can = mats >= need
        rep = (dur <= 0) & can
        repair_spend = np.where(rep, need, 0.0); mats -= repair_spend; dur = np.where(rep, 1.0, dur)
        # gear market: buyers want tier g+1
        nxt = np.minimum(g + 1, P["max_tier"])
        price = cost(nxt) * pm * (1 + P["margin"]) * (1 + P["tax"])
        need_uc = np.array([P["uc_need"].get(int(t), 0.0) for t in nxt])
        own = np.minimum(mats, cost(nxt)) * pm            # buyers can pay partly in their own materials
        wants = (g < P["max_tier"]) & (coin + own >= price) & (uc >= need_uc)
        D = cost(nxt)[wants].sum()
        cons_need = P["consumables"] * s * P["yield0"] * P["yield_g"] ** (g - 1)
        cons_price = cons_need * pm * (1 + P["margin"]) * (1 + P["tax"])
        cons_ok = coin >= cons_price
        D_c = cons_need[cons_ok].sum(); coin -= np.where(cons_ok, cons_price, 0.0)
        sink_now = 0.0
        qm_coin = 0.0
        S = mats.sum()
        # quartermaster demand is funded from last week's sunk coin
        if P["quartermaster"] and hist:
            qm_coin = P["quartermaster"] * hist[-1]["sink"]; D_q = qm_coin / pm
        else: D_q = 0.0
        fill = min(1.0, S / (D + D_q + D_c)) if D + D_q + D_c > 0 else 0.0
        buy = wants & (rng.random(n) < fill)
        used_own = np.where(buy, np.minimum(mats, cost(nxt)), 0.0)
        pay = np.where(buy, price - used_own * pm, 0.0); coin -= pay; mats -= used_own
        uc -= np.where(buy, need_uc, 0.0); g = np.where(buy, nxt, g); dur = np.where(buy, 1.0, dur)
        sold_total = max((cost(nxt)[buy] - used_own[buy]).sum(), 0.0) + (D_q + D_c) * fill
        share = mats / mats.sum() if mats.sum() > 0 else np.zeros(n)
        sold = np.minimum(share * sold_total, mats); mats -= sold
        income_m = sold * pm * (1 - P["tax"] - P["fee"]); coin += income_m
        sink_now += (sold * pm * (P["tax"] + P["fee"])).sum() + (pay * P["tax"] / (1 + P["tax"])).sum()
        cons_paid = cons_price[cons_ok].sum()
        sink_now += cons_paid * P["tax"] / (1 + P["tax"])
        marg = (pay.sum() + cons_paid) * P["margin"] / (1 + P["margin"]) / (1 + P["tax"])
        coin[crafter] += marg / max(crafter.sum(), 1)
        coin_in_circ = qm_coin * fill  # quartermaster spending returns to sellers (already inside income_m)
        pm = float(np.clip(pm * np.clip((D + D_q + D_c + 1e-9) / (S + 1e-9), 0.5, 2.0) ** 0.25, 0.02, 50))
        gross = faucet + earned * pm
        hist.append(dict(
            week=w + 1, pm=pm, coin_pc=coin.mean(), gear_sold=int(buy.sum()),
            glut_weeks=mats.sum() / max(earned.sum(), 1e-9), sink=sink_now, faucet=faucet.sum(),
            tier=[g[coh == i].mean() for i in range(3)],
            top=[(g[coh == i] >= P["max_tier"]).mean() for i in range(3)],
            repair_share=[(repair_spend[coh == i] * pm).sum() / max(gross[coh == i].sum(), 1e-9) for i in range(3)],
            broken=[(dur[coh == i] <= 0).mean() for i in range(3)],
            crafter_ratio=(marg / max(crafter.sum(), 1)) / max(np.median(faucet + income_m), 1e-9),
        ))
    return hist

SCEN = {
    "baseline (mild wear, cap on)": {},
    "no gear wear": dict(wear_ok=0, wear_fail=0),
    "harsh wear": dict(wear_ok=0.05, wear_fail=0.25),
    "no weekly cap": dict(uc_cap=0),
    "front-loaded weekly currency": dict(frontload=True),
    "quartermaster recycles 50% of sinks": dict(quartermaster=0.5),
    "consumables burn 25% of session yield": dict(consumables=0.25),
    "consumables 25% + harsh wear + front-load": dict(consumables=0.25, wear_ok=0.05, wear_fail=0.25, frontload=True),
    "no tax or fees": dict(tax=0, fee=0),
    "no season tier (cap at tier 5)": dict(max_tier=5),
}

def summary(h):
    late = h[8:]
    return dict(
        sold_w1_4=sum(x["gear_sold"] for x in h[:4]), sold_w10_13=sum(x["gear_sold"] for x in h[9:]),
        pm_end=h[-1]["pm"], coin_end=h[-1]["coin_pc"], glut_end=h[-1]["glut_weeks"],
        sink_ratio=sum(x["sink"] for x in h) / sum(x["faucet"] for x in h),
        tier_end=h[-1]["tier"], top_end=h[-1]["top"],
        repair=[np.mean([x["repair_share"][i] for x in late]) for i in range(3)],
        broken=[np.mean([x["broken"][i] for x in late]) for i in range(3)],
        crafter=np.mean([x["crafter_ratio"] for x in late]),
        half_top=[next((x["week"] for x in h if x["top"][i] >= 0.5), None) for i in range(3)],
    )

def push_or_extract():
    """Is 'push deeper or extract' a real choice? Expected-value check per depth."""
    out = []
    for name, s in [("casual", 0.75), ("regular", 0.85), ("hardcore", 0.95)]:
        for keep in (0.0, 0.4, 0.8):
            for cap in (None, 60.0, 120.0):
                B = 0.0; depth = 0
                for k in range(1, 9):
                    q = float(np.clip(s - 0.10 * (k - 1), 0.05, 0.98)); G = 10 * 1.5 ** (k - 1)
                    if cap is not None: G = max(min(G, cap - B), 0.0)
                    if k > 1 and q * G <= (1 - q) * (1 - keep) * B: break
                    B += G; depth = k
                out.append((name, keep, cap, depth))
    return out

def sensitivity(trials=40):
    """Shake every continuous assumption by +-40% and count how often each finding holds."""
    rng = np.random.default_rng(1); keys = ["yield0", "yield_g", "coin0", "coin_g", "cost0", "cost_g",
        "banked_on_fail", "wear_ok", "wear_fail", "repair_mats", "tax", "margin", "uc_per_win"]
    tally = dict(wear_keeps_market=0, harsh_hurts_casuals=0, cap_closes_gap=0, casuals_miss_top=0,
                 frontload_fixes=0, glut=0, coin_inflates=0, consumables_revive_crafting=0, consumables_clear_glut=0)
    for t in range(trials):
        o = {}
        for k in keys:
            f = rng.uniform(0.6, 1.4); v = BASE[k]
            o[k] = 1 + (v - 1) * f if k.endswith("_g") else v * f
        a = 1500
        b = summary(run(t, agents=a, **o)); nw = summary(run(t, agents=a, **{**o, "wear_ok": 0, "wear_fail": 0}))
        hw = summary(run(t, agents=a, **{**o, "wear_ok": o["wear_ok"] * 2.5, "wear_fail": o["wear_fail"] * 2.5}))
        nc = summary(run(t, agents=a, **{**o, "uc_cap": 0})); fl = summary(run(t, agents=a, **{**o, "frontload": True}))
        cs = summary(run(t, agents=a, **{**o, "consumables": 0.25}))
        tally["consumables_revive_crafting"] += cs["crafter"] > 2 * b["crafter"]
        tally["consumables_clear_glut"] += cs["glut_end"] < 0.5 * b["glut_end"]
        tally["wear_keeps_market"] += b["glut_end"] < 0.8 * nw["glut_end"]
        tally["harsh_hurts_casuals"] += hw["broken"][0] > b["broken"][0] + 0.10
        tally["cap_closes_gap"] += (nc["top_end"][2] - nc["top_end"][1]) > (b["top_end"][2] - b["top_end"][1]) + 0.05
        tally["casuals_miss_top"] += b["top_end"][0] < 0.05
        tally["frontload_fixes"] += fl["top_end"][0] > b["top_end"][0] + 0.2
        tally["glut"] += b["glut_end"] > 3
        tally["coin_inflates"] += b["sink_ratio"] < 0.5
    return {k: f"{v}/{trials}" for k, v in tally.items()}

if __name__ == "__main__":
    np.set_printoptions(precision=2, suppress=True)
    f = lambda xs: " ".join(f"{x:5.2f}" for x in xs)
    print("SCENARIOS (cohort order: casual, regular, hardcore)")
    for name, o in SCEN.items():
        r = summary(run(0, **o))
        print(f"\n{name}\n  gear sold wk1-4 {r['sold_w1_4']:5d} | wk10-13 {r['sold_w10_13']:5d} | material price end {r['pm_end']:.2f}"
              f" | unsold stock = {r['glut_end']:.1f} weeks of gathering\n  coin per player end {r['coin_end']:8.0f} | coin sunk / coin created {r['sink_ratio']:.2f}"
              f" | crafter margin income vs median player {r['crafter']:.2f}x\n  mean tier end {f(r['tier_end'])} | share at top tier {f(r['top_end'])}"
              f" | week half the cohort reaches top {r['half_top']}"
              f"\n  repair share of income {f(r['repair'])} | share with broken gear {f(r['broken'])}")
    print("\nWEEKLY (baseline vs no wear): week, gear sold, material price")
    a, b = run(0), run(0, wear_ok=0, wear_fail=0)
    for x, y in zip(a, b): print(f"  {x['week']:2d}  {x['gear_sold']:5d} {x['pm']:.2f}   |  {y['gear_sold']:5d} {y['pm']:.2f}")
    print("\nPUSH OR EXTRACT: optimal depth (segments) by skill, share kept on death, bag cap")
    for row in push_or_extract(): print("  ", row)
    print("\nSENSITIVITY (+-40% on 13 assumptions): how often each finding holds")
    for k, v in sensitivity().items(): print(f"  {k:28s} {v}")
