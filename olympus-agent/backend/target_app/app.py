def calculate_interest(principal: float, rate: float, time_years: float) -> float:
    if principal < 0:
        raise ValueError("Invalid principal value")
    if rate < 0:
        raise ValueError("Invalid rate value")
    if time_years <= 0:
        raise ValueError("Invalid time years value")
    return principal * (rate / 100) * time_years

def calculate_total(price: float, discount_percent: float = 0) -> float:
    if price < 0:
        raise ValueError("Invalid price value")
    discount_amount = price * (discount_percent / 100)
    return price - discount_amount

def apply_percentage_discount(price, discount_percent):
    return price - (price * (discount_percent / 100))

def main():
    price = 100
    discount = 20
    total = calculate_total(price, discount)
    print(f"Total after discount: {total}")

if __name__ == "__main__":
    main()