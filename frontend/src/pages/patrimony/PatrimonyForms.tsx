import type { FormEvent } from "react";
import { useState } from "react";

type MarketFormState = {
  name_asset: string;
  ticker: string;
  asset_type_code: string;
  quantity: string;
  buy_unit_price: string;
  valuation_date: string;
  notes: string;
};

type CashFormState = {
  name_asset: string;
  amount: string;
  valuation_date: string;
  notes: string;
};

type PhysicalFormState = {
  name_asset: string;
  estimated_value: string;
  valuation_date: string;
  notes: string;
};

type PatrimonyFormsProps = {
  marketForm: MarketFormState;
  cashForm: CashFormState;
  physicalForm: PhysicalFormState;
  onMarketChange: (next: MarketFormState) => void;
  onCashChange: (next: CashFormState) => void;
  onPhysicalChange: (next: PhysicalFormState) => void;
  onSubmitMarket: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSubmitCash: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onSubmitPhysical: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function PatrimonyForms({
  marketForm,
  cashForm,
  physicalForm,
  onMarketChange,
  onCashChange,
  onPhysicalChange,
  onSubmitMarket,
  onSubmitCash,
  onSubmitPhysical,
}: PatrimonyFormsProps) {
  const [activeForm, setActiveForm] = useState<"market" | "cash" | "physical">("market");

  return (
    <section className="panel form-panel patrimony-unified-form">
      <div className="section-title">Ajouter un actif</div>
      <div className="filters patrimony-form-switch">
        <button type="button" className={`year-chip ${activeForm === "market" ? "active" : ""}`} onClick={() => setActiveForm("market")}>
          Action / ETF / crypto
        </button>
        <button type="button" className={`year-chip ${activeForm === "cash" ? "active" : ""}`} onClick={() => setActiveForm("cash")}>
          Cash
        </button>
        <button type="button" className={`year-chip ${activeForm === "physical" ? "active" : ""}`} onClick={() => setActiveForm("physical")}>
          Actif physique
        </button>
      </div>

      {activeForm === "market" ? (
        <form className="patrimony-form-body" onSubmit={onSubmitMarket}>
          <div className="form-row">
            <label>
              Type
              <select value={marketForm.asset_type_code} onChange={(event) => onMarketChange({ ...marketForm, asset_type_code: event.target.value })}>
                <option value="STOCK">Action</option>
                <option value="ETF">ETF</option>
                <option value="CRYPTO">Crypto</option>
              </select>
            </label>
            <label>
              Ticker Yahoo
              <input value={marketForm.ticker} onChange={(event) => onMarketChange({ ...marketForm, ticker: event.target.value })} placeholder="AAPL, MC.PA, BTC-EUR..." />
            </label>
          </div>
          <label>
            Nom
            <input value={marketForm.name_asset} onChange={(event) => onMarketChange({ ...marketForm, name_asset: event.target.value })} placeholder="Apple, Air Liquide, Bitcoin..." />
          </label>
          <div className="form-row">
            <label>
              Quantité
              <input type="number" step="0.00000001" value={marketForm.quantity} onChange={(event) => onMarketChange({ ...marketForm, quantity: event.target.value })} />
            </label>
            <label>
              Prix d'achat unitaire
              <input type="number" step="0.00000001" value={marketForm.buy_unit_price} onChange={(event) => onMarketChange({ ...marketForm, buy_unit_price: event.target.value })} />
            </label>
          </div>
          <label>
            Date achat
            <input type="date" value={marketForm.valuation_date} onChange={(event) => onMarketChange({ ...marketForm, valuation_date: event.target.value })} />
          </label>
          <button className="primary-button">Ajouter avec prix actuel</button>
        </form>
      ) : null}

      {activeForm === "cash" ? (
        <form className="patrimony-form-body" onSubmit={onSubmitCash}>
          <label>
            Nom du compte
            <input value={cashForm.name_asset} onChange={(event) => onCashChange({ ...cashForm, name_asset: event.target.value })} placeholder="Livret A, Banque, espèces..." />
          </label>
          <div className="form-row">
            <label>
              Montant
              <input type="number" value={cashForm.amount} onChange={(event) => onCashChange({ ...cashForm, amount: event.target.value })} />
            </label>
            <label>
              Date
              <input type="date" value={cashForm.valuation_date} onChange={(event) => onCashChange({ ...cashForm, valuation_date: event.target.value })} />
            </label>
          </div>
          <button className="primary-button">Ajouter cash</button>
        </form>
      ) : null}

      {activeForm === "physical" ? (
        <form className="patrimony-form-body" onSubmit={onSubmitPhysical}>
          <label>
            Nom
            <input value={physicalForm.name_asset} onChange={(event) => onPhysicalChange({ ...physicalForm, name_asset: event.target.value })} placeholder="Montre, voiture, objet..." />
          </label>
          <div className="form-row">
            <label>
              Valeur
              <input type="number" value={physicalForm.estimated_value} onChange={(event) => onPhysicalChange({ ...physicalForm, estimated_value: event.target.value })} />
            </label>
            <label>
              Date
              <input type="date" value={physicalForm.valuation_date} onChange={(event) => onPhysicalChange({ ...physicalForm, valuation_date: event.target.value })} />
            </label>
          </div>
          <button className="primary-button">Ajouter actif</button>
        </form>
      ) : null}
    </section>
  );
}
