# Tissquad — Shipping Badge

Badge **"Spedito da Tissquad × Amazon Shipping"** da mostrare sotto il pulsante *Aggiungi al Carrello* nella pagina prodotto di Shopify.

## File

| File | Descrizione |
|------|-------------|
| `snippets/shipping-badge.liquid` | Markup HTML del badge |
| `assets/shipping-badge.css` | Stili CSS del badge |

## Integrazione nel tema

### 1. Carica il CSS

Nel file `layout/theme.liquid`, dentro `<head>`, aggiungi:

```liquid
{{ 'shipping-badge.css' | asset_url | stylesheet_tag }}
```

### 2. Inserisci il badge nella pagina prodotto

Apri la sezione del form prodotto (es. `sections/main-product.liquid` per il tema Dawn) e, subito dopo il pulsante *Aggiungi al Carrello*, aggiungi:

```liquid
{% render 'shipping-badge' %}
```

Esempio nel contesto del form:

```liquid
<button type="submit" name="add" class="btn product-form__cart-submit">
  Aggiungi al Carrello
</button>

{% render 'shipping-badge' %}
```

## Anteprima badge

```
┌─────────────────────────────────────────────┐
│  🚚  Spedito da Tissquad × Amazon Shipping  │
└─────────────────────────────────────────────┘
```

Colori: sfondo `#fff8f0`, bordo/icona `#f0a500`, testo Amazon `#e47911`.
