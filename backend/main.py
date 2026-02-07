import asyncio
from dedalus_labs import DedalusRunner, Client
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Retrieve the API key from environment variables
api_key = os.getenv("DEDALUS_API_KEY")

# Ensure the API key is not None
if not api_key:
    raise ValueError("DEDALUS_API_KEY is not set in the .env file")

# Initialize the client
client = Client(api_key=api_key)

async def main():
    runner = DedalusRunner(client)

    response = await runner.run(
        input="What are the key factors that influence weather patterns?",
        model="anthropic/claude-opus-4-6",
    )

    print(response.final_output)

if __name__ == "__main__":
    asyncio.run(main())
    