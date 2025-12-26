"""
Seed Knowledge Base with Sample Building Codes
Run this script to populate the KB with sample compliance data
"""

import sys
import os
import asyncio

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal, engine
from app.models import User, Organization, KnowledgeSource, KBChunk
from app.services.embeddings import EmbeddingService
import uuid
from datetime import datetime

# Sample building code content
BUILDING_CODES = [
    {
        "title": "General Building Requirements",
        "category": "building_code",
        "source_type": "building_code",
        "content": """
GENERAL BUILDING REQUIREMENTS

1. STRUCTURAL INTEGRITY
All buildings must be designed and constructed to safely support all anticipated loads including:
- Dead loads (permanent structural elements)
- Live loads (occupancy and moveable equipment)
- Environmental loads (wind, snow, seismic)

2. FOUNDATION REQUIREMENTS
- Minimum depth: 4 feet below frost line
- Bearing capacity must be verified by geotechnical engineer
- Footings must be continuous under bearing walls
- Concrete minimum strength: 3000 psi

3. EGRESS REQUIREMENTS
- Every building must have at least two means of egress
- Exit doors must swing in direction of egress travel
- Minimum corridor width: 44 inches for occupancy >50
- Exit signs must be illuminated and visible
"""
    },
    {
        "title": "Accessibility Requirements - ADA Compliance",
        "category": "accessibility",
        "source_type": "building_code",
        "content": """
ACCESSIBILITY REQUIREMENTS (ADA)

1. ENTRANCES AND EXITS
- At least one accessible entrance required
- Entrance must be on accessible route
- Automatic door openers required for main entrance
- Threshold maximum: 1/2 inch

2. RAMPS
- Maximum slope: 1:12 (1 inch rise per 12 inches run)
- Minimum width: 36 inches clear
- Handrails required both sides if rise > 6 inches
- Landing required every 30 feet and at direction changes

3. ELEVATORS
- Required in buildings over 3 stories
- Car minimum dimensions: 80" x 51"
- Door minimum width: 36 inches clear
- Controls: maximum height 54 inches

4. RESTROOMS
- Accessible stall minimum: 60" x 60"
- Grab bars required both sides of toilet
- Sink maximum height: 34 inches
- Clear floor space: 30" x 48" minimum

5. PARKING
- 1 accessible space per 25 regular spaces
- Van accessible space required (1 in 6 accessible spaces)
- Minimum width: 8 feet (11 feet for van)
- Access aisle: 5 feet minimum
"""
    },
    {
        "title": "Fire Safety Code",
        "category": "fire_safety",
        "source_type": "building_code",
        "content": """
FIRE SAFETY REQUIREMENTS

1. FIRE SEPARATION
- 1-hour fire-rated walls between dwelling units
- 2-hour fire-rated walls for exit stairs
- Fire doors must be self-closing with positive latching

2. SPRINKLER SYSTEMS
- Required in all buildings over 4 stories
- Required in all residential units
- Coverage: 1 sprinkler per 200 sq ft maximum
- Water supply must meet demand for 30 minutes

3. FIRE ALARMS
- Required in all commercial buildings
- Smoke detectors in each sleeping room
- Audible alarm must be heard throughout building
- Emergency voice communication in high-rises

4. EXIT REQUIREMENTS
- Travel distance to exit: maximum 200 feet
- Exit width: 0.2 inches per occupant
- Exit discharge directly to public way
- Emergency lighting required in exit paths

5. FIRE EXTINGUISHERS
- Type A extinguishers every 75 feet
- Maximum travel distance: 75 feet
- Mounting height: 3.5 to 5 feet to top
- Annual inspection required
"""
    },
    {
        "title": "Electrical Code Requirements",
        "category": "electrical_code",
        "source_type": "building_code",
        "content": """
ELECTRICAL CODE REQUIREMENTS

1. GENERAL WIRING
- All wiring must be in conduit or armored cable
- Grounding required for all circuits
- Circuit breakers must be labeled
- Minimum wire size: 14 AWG for 15A circuits

2. OUTLETS
- Maximum spacing: 12 feet along walls
- GFCI required in wet locations (kitchen, bath, exterior)
- AFCI required in bedrooms
- Tamper-resistant receptacles in dwelling units

3. SERVICE ENTRANCE
- Minimum service: 100 amperes residential
- 200 amperes for buildings over 3000 sq ft
- Main disconnect required
- Grounding electrode system required

4. LIGHTING
- Emergency lighting: minimum 1 foot-candle
- Exit lighting must be on emergency circuit
- Minimum clearance above finish floor: 7 feet
"""
    },
    {
        "title": "Plumbing Code Requirements",
        "category": "plumbing_code",
        "source_type": "building_code",
        "content": """
PLUMBING CODE REQUIREMENTS

1. WATER SUPPLY
- Minimum pressure: 20 psi at highest fixture
- Maximum pressure: 80 psi (reducer required)
- Backflow prevention required
- Hot water temperature: maximum 120°F at fixtures

2. DRAINAGE
- Minimum slope: 1/4 inch per foot for drains
- Traps required on all fixtures
- Vent required within 5 feet of trap
- Cleanouts required every 100 feet

3. FIXTURES
- Minimum toilet clearance: 15 inches from centerline
- Sink minimum dimensions: 18" x 12"
- Water closet minimum space: 30" x 48"

4. FIXTURE REQUIREMENTS BY OCCUPANCY
Assembly (per 150): 1 toilet, 1 sink
Office (per 25): 1 toilet
Restaurant (per 75): 1 toilet
"""
    }
]

async def seed_kb():
    """Seed knowledge base with sample building codes"""
    db = SessionLocal()
    embedding_service = EmbeddingService()
    
    try:
        print("🔍 Checking for existing data...")
        
        # Get first organization (should exist from auth setup)
        org = db.query(Organization).first()
        if not org:
            print("❌ No organization found. Please create an organization first.")
            return
        
        print(f"✅ Using organization: {org.name}")
        
        # Get first user for uploaded_by
        user = db.query(User).first()
        if not user:
            print("❌ No user found. Please create a user first.")
            return
        
        # Check if KB already has content
        existing_count = db.query(KnowledgeSource).filter(
            KnowledgeSource.org_id == org.id
        ).count()
        
        if existing_count > 0:
            print(f"⚠️  Knowledge base already has {existing_count} documents.")
            response = input("Do you want to add more? (y/n): ")
            if response.lower() != 'y':
                print("❌ Cancelled")
                return
        
        print("\n📚 Seeding knowledge base...")
        
        for doc in BUILDING_CODES:
            print(f"\n📄 Processing: {doc['title']}")
            
            # Create knowledge source
            source = KnowledgeSource(
                id=uuid.uuid4(),
                org_id=org.id,
                title=doc['title'],
                source_type=doc['source_type'],
                category=doc['category'],
                file_id=None,  # Not from file
                status="indexed",
                uploaded_by=user.id,
                meta_data={"seeded": True, "created_by": "seed_script"}
            )
            db.add(source)
            db.flush()
            
            # Split content into chunks (simple split by paragraphs)
            content = doc['content'].strip()
            paragraphs = [p.strip() for p in content.split('\n\n') if p.strip()]
            
            print(f"   Splitting into {len(paragraphs)} chunks...")
            
            for idx, chunk_text in enumerate(paragraphs):
                if len(chunk_text) < 20:  # Skip very short chunks
                    continue
                
                # Generate embedding
                print(f"   Generating embedding for chunk {idx + 1}...", end='\r')
                embedding = await embedding_service.generate_embedding(chunk_text)
                
                if embedding is None:
                    print(f"   ⚠️  Failed to generate embedding for chunk {idx + 1}")
                    continue
                
                # Create chunk
                chunk = KBChunk(
                    id=uuid.uuid4(),
                    knowledge_source_id=source.id,
                    chunk_index=idx,
                    chunk_text=chunk_text,
                    embedding=embedding,
                    chunk_metadata={"length": len(chunk_text)}
                )
                db.add(chunk)
            
            print(f"   ✅ Created {len(paragraphs)} chunks for {doc['title']}")
        
        db.commit()
        
        # Print summary
        total_sources = db.query(KnowledgeSource).filter(
            KnowledgeSource.org_id == org.id
        ).count()
        total_chunks = db.query(KBChunk).join(KnowledgeSource).filter(
            KnowledgeSource.org_id == org.id
        ).count()
        
        print("\n" + "="*60)
        print("✅ Knowledge Base Seeded Successfully!")
        print("="*60)
        print(f"📊 Total Documents: {total_sources}")
        print(f"📊 Total Chunks: {total_chunks}")
        print(f"🏢 Organization: {org.name}")
        print("\n💡 You can now run compliance analysis!")
        
    except Exception as e:
        print(f"\n❌ Error seeding knowledge base: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("\n" + "="*60)
    print("🌱 Knowledge Base Seeding Script")
    print("="*60)
    asyncio.run(seed_kb())
