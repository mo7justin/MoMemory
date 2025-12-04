"\"\"\"Graph Memory router for Neo4j data.\"\"\""

from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
import os
from neo4j import GraphDatabase
from pydantic import BaseModel

router = APIRouter()

# Neo4j connection configuration
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://neo4j:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")


class GraphNode(BaseModel):
    id: str
    group: str
    val: int
    name: str
    color: str | None = None


class GraphLink(BaseModel):
    source: str
    target: str
    type: str


class GraphDataResponse(BaseModel):
    nodes: List[GraphNode]
    links: List[GraphLink]


def get_neo4j_driver():
    try:
        driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
        return driver
    except Exception as exc:
        print(f"Failed to create Neo4j driver: {exc}")
        return None


@router.get("/data", response_model=GraphDataResponse)
async def get_graph_data():
    """Fetch graph nodes and links from Neo4j."""
    driver = get_neo4j_driver()
    if not driver:
        # Soft-fail, return empty graph instead of 500
        return {"nodes": [], "links": []}

    query = """
    MATCH (n)
    OPTIONAL MATCH (n)-[r]->(m)
    RETURN n, r, m
    LIMIT 300
    """

    nodes_dict: Dict[str, Dict[str, Any]] = {}
    links_list: List[Dict[str, str]] = []

    try:
        with driver.session() as session:
            result = session.run(query)

            for record in result:
                node = record["n"]
                if node:
                    node_id = (
                        str(node.element_id)
                        if hasattr(node, "element_id")
                        else str(node.id)
                    )
                    labels = list(node.labels)
                    group = labels[0] if labels else "Unknown"
                    name = node.get("name", node.get("title", "Untitled"))

                    if node_id not in nodes_dict:
                        color = "#3b82f6"
                        if "Person" in labels:
                            color = "#ef4444"
                        elif "Event" in labels:
                            color = "#10b981"
                        elif "Location" in labels:
                            color = "#f59e0b"
                        elif "Concept" in labels:
                            color = "#8b5cf6"

                        nodes_dict[node_id] = {
                            "id": node_id,
                            "group": group,
                            "val": 10,
                            "name": name,
                            "color": color,
                        }

                rel = record["r"]
                target = record["m"]

                if rel and target and node:
                    target_id = (
                        str(target.element_id)
                        if hasattr(target, "element_id")
                        else str(target.id)
                    )
                    target_labels = list(target.labels)
                    target_group = target_labels[0] if target_labels else "Unknown"
                    target_name = target.get("name", target.get("title", "Untitled"))

                    if target_id not in nodes_dict:
                        color = "#3b82f6"
                        if "Person" in target_labels:
                            color = "#ef4444"
                        elif "Event" in target_labels:
                            color = "#10b981"
                        elif "Location" in target_labels:
                            color = "#f59e0b"
                        elif "Concept" in target_labels:
                            color = "#8b5cf6"

                        nodes_dict[target_id] = {
                            "id": target_id,
                            "group": target_group,
                            "val": 10,
                            "name": target_name,
                            "color": color,
                        }

                    links_list.append(
                        {
                            "source": nodes_dict[node_id]["id"],
                            "target": nodes_dict[target_id]["id"],
                            "type": rel.type,
                        }
                    )
    except Exception as exc:
        print(f"Error querying Neo4j: {exc}")
        raise HTTPException(status_code=500, detail="Failed to query graph data")
    finally:
        driver.close()

    return {"nodes": list(nodes_dict.values()), "links": links_list}

