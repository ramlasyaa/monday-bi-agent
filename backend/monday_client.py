import requests
import pandas as pd
import logging

logger = logging.getLogger(__name__)

MONDAY_API_URL = "https://api.monday.com/v2"

def fetch_board_items(api_token: str, board_id: str) -> pd.DataFrame:
    """
    Queries Monday.com GraphQL API for a board's items and columns.
    Handles cursor-based pagination.
    Maps items and their columns by title to construct a Pandas DataFrame.
    """
    headers = {
        "Authorization": api_token,
        "Content-Type": "application/json",
        "API-Version": "2024-01"
    }

    # Initial Query
    initial_query = """
    query ($boardId: [ID!], $limit: Int!) {
      boards(ids: $boardId) {
        name
        items_page(limit: $limit) {
          cursor
          items {
            id
            name
            column_values {
              id
              title
              text
            }
          }
        }
      }
    }
    """

    variables = {
        "boardId": [str(board_id)],
        "limit": 100
      }

    logger.info(f"Fetching initial items for board {board_id}...")
    try:
        response = requests.post(
            MONDAY_API_URL, 
            json={"query": initial_query, "variables": variables}, 
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
    except Exception as e:
        raise Exception(f"Failed to connect to Monday.com API: {str(e)}")

    res_json = response.json()
    if "errors" in res_json:
        raise Exception(f"Monday.com API returned error: {res_json['errors'][0]['message']}")

    boards = res_json.get("data", {}).get("boards", [])
    if not boards:
        raise Exception(f"Board ID {board_id} not found in your Monday.com account.")

    board_data = boards[0]
    board_name = board_data.get("name", "Unknown Board")
    items_page = board_data.get("items_page", {})
    cursor = items_page.get("cursor")
    raw_items = items_page.get("items", [])

    logger.info(f"Loaded {len(raw_items)} items from board '{board_name}' (initial page).")

    # Pagination Query for subsequent pages
    next_query = """
    query ($cursor: String!, $limit: Int!) {
      next_items_page(cursor: $cursor, limit: $limit) {
        cursor
        items {
          id
          name
          column_values {
            id
            title
            text
          }
        }
      }
    }
    """

    page = 1
    while cursor:
        page += 1
        logger.info(f"Fetching items page {page} with cursor...")
        next_vars = {
            "cursor": cursor,
            "limit": 100
        }
        try:
            next_resp = requests.post(
                MONDAY_API_URL,
                json={"query": next_query, "variables": next_vars},
                headers=headers,
                timeout=30
            )
            next_resp.raise_for_status()
        except Exception as e:
            logger.warning(f"Error fetching page {page}, stopping pagination: {str(e)}")
            break

        next_json = next_resp.json()
        if "errors" in next_json:
            logger.warning(f"GraphQL error on page {page}, stopping pagination: {next_json['errors'][0]['message']}")
            break

        next_page = next_json.get("data", {}).get("next_items_page", {})
        cursor = next_page.get("cursor")
        new_items = next_page.get("items", [])
        raw_items.extend(new_items)
        logger.info(f"Loaded {len(new_items)} additional items (Total: {len(raw_items)}).")
        
        # Guard rail to prevent infinite loops / excessive API consumption
        if page > 20:
            logger.warning("Pagination limit exceeded 20 pages. Truncating.")
            break

    # Parse raw items to list of dicts
    parsed_rows = []
    for item in raw_items:
        row = {
            "monday_item_id": item["id"],
            "monday_item_name": item["name"]
        }
        # In Monday.com, the 'name' column is the item's main label
        # We'll save it under a general 'Item Name' key, and then map it 
        # to the Deals or Work Orders primary name column below
        
        for val in item.get("column_values", []):
            title = val.get("title")
            text = val.get("text")
            if title:
                row[title] = text
        
        parsed_rows.append(row)

    df = pd.DataFrame(parsed_rows)
    if df.empty:
        return df

    # Map the primary name column from Monday.com's item name
    # Deals board uses 'Deal Name', Work Orders board uses 'Deal name masked'
    # Check column existence and populate from item name if missing/empty
    if 'Deal Name' not in df.columns:
        df['Deal Name'] = df['monday_item_name']
    else:
        df['Deal Name'] = df['Deal Name'].fillna(df['monday_item_name']).replace('', df['monday_item_name'])

    if 'Deal name masked' not in df.columns:
        df['Deal name masked'] = df['monday_item_name']
    else:
        df['Deal name masked'] = df['Deal name masked'].fillna(df['monday_item_name']).replace('', df['monday_item_name'])

    return df
