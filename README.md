# Vat-Officer

A free, self-hosted digital kneeboard for VATSIM pilots.

## Features

- Track flight data, squawk, ATIS, taxi notes, and live VATSIM flight details.
- Upload custom checklist JSON files and keep checklist progress in your browser.
- View active VATSIM controller frequencies by airport or FIR.
- Send and receive Hoppie ACARS messages, including PDC requests.
- Look up VATSIM ATIS and real-world METAR data.

## Run Locally With Docker

You need Docker with Docker Compose.

```bash
git clone https://github.com/<your-fork>/VatSim-Copilot.git
cd VatSim-Copilot
docker compose up -d
```

Open `http://localhost:8000`.

To use a different local port, change the left side of the `ports` value in `docker-compose.yml`, for example `"8080:8000"`.

## Run Without Docker

Start the backend:

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Start the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Hoppie ACARS

ACARS is optional. If you use it, enter your own Hoppie logon code in the app. You can request one from [Hoppie's ACARS](https://www.hoppie.nl/acars/).

## Custom Checklists

Upload checklists as JSON files. See `examples/sample-checklist.json` for a fuller example.

```json
{
  "title": "Boeing 777 Startup",
  "description": "Cold and dark to before taxi",
  "categories": [
    {
      "name": "Overhead Panel",
      "context": "Starting from the left side",
      "items": [
        "Battery switches ON",
        "External power CONNECTED",
        "ADIRU selectors NAV"
      ]
    }
  ]
}
```

## API Docs

Interactive API docs are available at `http://localhost:8000/api/docs`.

## License

[MIT](LICENSE)
