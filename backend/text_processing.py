import torch
from transformers import DistilBertTokenizer, DistilBertModel

# Load BERT model and tokenizer
tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
device = "cuda" if torch.cuda.is_available() else "cpu"
model = DistilBertModel.from_pretrained("distilbert-base-uncased").to(device)

# Define projection layer outside the function to ensure it's consistent across calls
linear_projection = torch.nn.Linear(768, 512).to(device)

def get_text_embeddings(web_text: str):
    inputs = tokenizer(web_text, return_tensors="pt", padding=True, truncation=True, max_length=512)
    
    # Forward pass through BERT
    with torch.no_grad():
        inputs = {i: k.to(device) for i, k in inputs.items()}
        outputs = model(**inputs)
    
    # Extract the [CLS] token embedding, which represents the entire sentence
    # The [CLS] token is the first token (index 0) in the sequence
    cls_embedding = outputs.last_hidden_state[:, 0, :]  # Shape: [batch_size, 768]
    
    # Apply the linear projection to reduce from 768 to 512 dimensions
    projected_embedding = linear_projection(cls_embedding)  # Shape: [batch_size, 512]
    
    # Convert to a 1D list for the API response
    return projected_embedding.cpu().detach().numpy()[0].tolist()  # Shape: [512]