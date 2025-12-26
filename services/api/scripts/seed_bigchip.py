#!/usr/bin/env python3
"""Seed knowledge base for Big Chip organization"""
import sys
import asyncio
from sqlalchemy.orm import Session
sys.path.insert(0, '/app')

from app.core.database import SessionLocal
from app.models import Organization, User, KnowledgeSource, KBChunk
from app.services.embeddings import EmbeddingService

# Building codes data
BUILDING_CODES = [
    {
        "title": "General Building Requirements",
        "category": "building_code",
        "content": """GENERAL BUILDING REQUIREMENTS

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
- Exit signs must be illuminated and visible""",
    },
    {
        "title": "Accessibility Requirements - ADA Compliance",
        "category": "accessibility",
        "content": """ACCESSIBILITY REQUIREMENTS (ADA)

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
- Access aisle: 5 feet minimum""",
    },
    {
        "title": "Fire Safety Code",
        "category": "fire_safety",
        "content": """FIRE SAFETY REQUIREMENTS

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
- Annual inspection required""",
    },
]


async def seed_kb():
    db = SessionLocal()
    embedding_service = EmbeddingService()

    try:
        # Get Big Chip organization
        org = db.query(Organization).filter(Organization.name == "Big Chip").first()
        if not org:
            print("❌ Big Chip organization not found")
            return

        print(f"✅ Using organization: {org.name} ({org.id})")

        # Get first user
        user = db.query(User).first()

        total_chunks = 0
        for code_data in BUILDING_CODES:
            print(f"📄 Processing: {code_data['title']}")

            # Create knowledge source
            source = KnowledgeSource(
                org_id=org.id,
                title=code_data["title"],
                source_type="building_code",
                category=code_data["category"],
                file_id=None,
                meta_data={"seeded": True, "created_by": "seed_script"},
                language="en",
                status="indexed",
                uploaded_by=user.id,
            )
            db.add(source)
            db.flush()

            # Split into chunks by paragraph
            paragraphs = [
                p.strip() for p in code_data["content"].split("\n\n") if p.strip()
            ]
            print(f"   Splitting into {len(paragraphs)} chunks...")

            # Create chunks
            for idx, paragraph in enumerate(paragraphs):
                # Generate embedding
                embedding_vec = await embedding_service.generate_embedding(paragraph)

                chunk = KBChunk(
                    knowledge_source_id=source.id,
                    org_id=None,
                    chunk_text=paragraph,
                    chunk_index=idx,
                    embedding=embedding_vec,
                    chunk_metadata={"length": len(paragraph)},
                )
                db.add(chunk)
                total_chunks += 1

            print(f"   ✅ Created {len(paragraphs)} chunks")

        db.commit()
        print(
            f"\n✅ Seeded {len(BUILDING_CODES)} documents with {total_chunks} chunks for {org.name}"
        )

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    # Run the async function
    asyncio.run(seed_kb())
